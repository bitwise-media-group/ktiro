# Copyright 2026 BitWise Media Group Ltd
# SPDX-License-Identifier: MIT

variable "cluster" {
  description = <<-EOT
    The cluster to install ktiro onto: pass terraform-google-gke-flux's application_target output verbatim (through
    terraform_remote_state or any other channel). It is handed to that repo's modules/application unchanged, and
    supplies the platform registry the image is published beneath (oci://<platform_registry>/manifests/ktiro) and the
    signing mode (keyless clusters verify the image against signed_identity_subject, KMS-keyed clusters against the
    cosign-pub Secret).
  EOT
  type = object({
    name              = string
    namespace         = string
    platform_registry = string
    tree              = string
    issuer            = optional(string)
    keyed             = bool
    project           = string
    project_number    = string
    workload_pool     = string
    secret_prefix     = string

    location             = optional(string)
    node_locations       = optional(set(string), [])
    node_service_account = optional(string)
  })
  nullable = false

  validation {
    condition     = can(regex("^[a-z0-9-]+-docker\\.pkg\\.dev/[^/]+/[^/]+$", var.cluster.platform_registry))
    error_message = "cluster.platform_registry must be an Artifact Registry docker repository prefix: <location>-docker.pkg.dev/<project>/<repository> (is this a terraform-google-gke-flux application_target?)."
  }
}

variable "host" {
  description = <<-EOT
    The label ktiro is served under, published as KTIRO_HOST: the prototype is https://<host>.<PLATFORM_DOMAIN>, on the
    platform gateway's wildcard listener and certificate, and public (no sign-in). An RFC-1035 label.
  EOT
  type        = string
  nullable    = false
  default     = "ktiro"

  validation {
    condition     = can(regex("^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$", var.host))
    error_message = "host must be an RFC-1035 label: lowercase letters, digits and hyphens, starting with a letter, at most 63 characters."
  }
}

variable "image" {
  description = <<-EOT
    Which builds of the manifests image (oci://<cluster.platform_registry>/manifests/ktiro) the seed follows, passed
    straight through to the cluster module's modules/application image (semver and channel only). The default follows
    the edge channel below 1.0.0, so every push to main reaches the cluster.
      - semver: the tag range; with channel edge it needs a pre-release bound (^0.1.0-0). A range matching no tag
        prunes the application.
      - channel: edge or stable. edge follows the newest <version>-edge.<yyyymmddhhmmss>.g<commit> build; stable
        follows the newest vX.Y.Z and takes no semver.
  EOT
  type = object({
    semver  = optional(string)
    channel = optional(string)
  })
  nullable = false
  default  = { channel = "edge", semver = "<1.0.0-0 >=0.0.0-0" }
}

variable "signed_identity_subject" {
  description = <<-EOT
    Fulcio certificate-subject regexp (keyless cosign) of the workflow that signs this repo's builds: the seed's verify
    subject for the manifests image, and KTIRO_IMAGE_SUBJECT, which the image's own verify-ktiro-signature policy holds
    the server image to. This repo's release.yaml on main by default. Ignored on KMS-keyed clusters (cluster.keyed),
    which verify both against the signing key instead.
  EOT
  type        = string
  nullable    = false
  default     = "^https://github\\.com/bitwise-media-group/ktiro/\\.github/workflows/release\\.yaml@refs/heads/main$"
}

variable "extra_vars" {
  description = <<-EOT
    Further ktiro-vars keys merged beside the ones this module owns. Keys must be SCREAMING_SNAKE_CASE and must not be
    one of this module's own keys (KTIRO_*): set those through their own inputs.
  EOT
  type        = map(string)
  nullable    = false
  default     = {}

  validation {
    condition     = alltrue([for key in keys(var.extra_vars) : can(regex("^[A-Z][A-Z0-9_]*$", key))])
    error_message = "extra_vars must use SCREAMING_SNAKE_CASE keys (^[A-Z][A-Z0-9_]*$), the shape flux substitution reads."
  }

  validation {
    condition     = alltrue([for key in keys(var.extra_vars) : !startswith(key, "KTIRO_")])
    error_message = "extra_vars must not set a key this module owns (KTIRO_*) - use its input instead."
  }
}
