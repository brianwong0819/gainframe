# Replaces Cognito IDs in Terraform output that mask-cognito-ids.sh cannot
# mask because they are not in the state yet (an apply or plan that creates
# the user pool or its client). Use with sed -E -f. CI logs are public
# (CLAUDE.md, "Security").
s/ap-southeast-1_[0-9A-Za-z]+/<user-pool-id>/g
/aws_cognito_user_pool_client\./ s/\[id=[^]]*\]/[id=<client-id>]/
