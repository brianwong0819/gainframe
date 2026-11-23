output "alarm_topic_arn" {
  description = "The owner subscribes an email address to it by hand (docs/debugging.md), so the address never reaches the repository or the state."
  value       = aws_sns_topic.alarms.arn
  sensitive   = true
}
