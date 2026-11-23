# Alerts and saved queries ("Observability" in docs/architecture.md, runbook in
# docs/debugging.md). Every resource is free at this volume: the first 10
# alarms and 10 custom metrics of the account, 1,000 SNS email notifications a
# month, and query definitions.

# The alarms' one destination. The email subscription is created by hand,
# because it needs the owner's address and a confirmation click.
resource "aws_sns_topic" "alarms" {
  name = "${var.name}-alarms"
}

# Hono turns a thrown error into a 500 response, so Lambda's Errors metric never
# sees it; the logger's `error` lines do. No default value: a period without
# errors has no data point, and the alarm treats missing data as fine.
resource "aws_cloudwatch_log_metric_filter" "error_lines" {
  for_each = var.log_groups

  name           = "${var.name}-${each.key}-error-lines"
  log_group_name = each.value
  pattern        = "{ $.level = \"error\" }"

  metric_transformation {
    name      = "ErrorLines"
    namespace = "Gainframe/${var.name}"
    value     = "1"
    unit      = "Count"
  }
}

# Any error line: each one needs action (docs/architecture.md, log levels).
resource "aws_cloudwatch_metric_alarm" "error_lines" {
  alarm_name          = "${var.name}-error-lines"
  alarm_description   = "An error line was logged. Find it with the saved query errors."
  namespace           = "Gainframe/${var.name}"
  metric_name         = "ErrorLines"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  depends_on = [aws_cloudwatch_log_metric_filter.error_lines]
}

# Failures that never reach the logger: Errors counts crashes, init failures
# and timeouts; Throttles counts requests refused at the concurrency limit.
resource "aws_cloudwatch_metric_alarm" "api" {
  for_each = {
    errors    = "Errors"
    throttles = "Throttles"
  }

  alarm_name          = "${var.name}-api-${each.key}"
  alarm_description   = "The API function reported ${each.value}. Its REPORT and error lines are in the API log group."
  namespace           = "AWS/Lambda"
  metric_name         = each.value
  dimensions          = { FunctionName = var.api_function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

# Saved Logs Insights queries, in a folder named after the environment. A
# query definition stores no time range; pick it when running the query.
locals {
  queries = {
    by-request-id  = <<-EOT
      fields @timestamp, @log, level, msg, route, status, durationMs, errorName, errorMessage, release
      | filter requestId = "REPLACE_WITH_REQUEST_ID"
      | sort @timestamp asc
    EOT
    errors         = <<-EOT
      fields @timestamp, @log, requestId, msg, route, errorName, errorMessage, release
      | filter level = "error"
      | sort @timestamp desc
      | limit 100
    EOT
    slowest-routes = <<-EOT
      filter msg = "request"
      | stats count() as requests, avg(durationMs) as avgMs, pct(durationMs, 95) as p95Ms, max(durationMs) as maxMs by route
      | sort p95Ms desc
    EOT
  }
}

resource "aws_cloudwatch_query_definition" "this" {
  for_each = local.queries

  name            = "${var.name}/${each.key}"
  log_group_names = values(var.log_groups)
  query_string    = each.value
}
