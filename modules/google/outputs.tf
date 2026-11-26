# Copyright 2026 BitWise Media Group Ltd
# SPDX-License-Identifier: MIT

output "release" {
  description = "The seed release (application-ktiro) in the cluster's flux namespace, reconciled by every apply."
  value       = module.application.release
}

output "vars" {
  description = "The ktiro-vars ConfigMap contents: the host label and the image signing subject, plus extra_vars."
  value       = merge(var.extra_vars, local.vars)
}

output "host" {
  description = <<-EOT
    The host label: ktiro is served at https://<host>.<PLATFORM_DOMAIN>. The domain is a cluster var terraform does not
    see here, so the full URL is the caller's to compose.
  EOT
  value       = var.host
}
