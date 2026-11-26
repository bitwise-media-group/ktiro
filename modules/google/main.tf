# Copyright 2026 BitWise Media Group Ltd
# SPDX-License-Identifier: MIT

# ktiro, the software-factory prototype, on Google Cloud, installed onto a
# terraform-google-gke-flux cluster as a self-contained application: the
# cluster root never learns ktiro exists. A root holding the cluster's
# application_target composes it:
#
#   module "ktiro" {
#     source  = ".../ktiro//modules/google"
#     cluster = module.cluster.application_target
#   }
#
# ktiro holds no cloud identity and no state - the page is baked into its
# image - so all this module does is the cluster-facing half, through the
# cluster module's modules/application: the seed (application-ktiro), the
# ktiro-vars ConfigMap and the pre-created ktiro namespace. It is public by
# design: the prototype runs on demo data only, so there is no dex client.

locals {
  # The application's own ConfigMap (ktiro-vars), substituted into the
  # manifests alongside cluster-vars. Every key always, so the manifests read
  # them bare.
  vars = {
    KTIRO_HOST          = var.host
    KTIRO_IMAGE_SUBJECT = var.signed_identity_subject
  }
}

module "application" {
  source = "git::https://github.com/bitwise-media-group/terraform-google-gke-flux.git//modules/application?ref=ddc4be2df68bf7e24f59d7bb646e5a440a79b204"

  name    = "ktiro"
  cluster = var.cluster

  image = {
    url     = "oci://${var.cluster.platform_registry}/manifests/ktiro"
    semver  = var.image.semver
    channel = var.image.channel
    # the image's per-cloud tree sits at its root (./google)
    path = "./${var.cluster.tree}"
    # kyverno-policies before the image policy and its exception
    depends_on = ["kyverno-policies"]
    # keyless clusters pin this repo's publish identity; KMS-keyed clusters
    # verify against the cosign-pub Secret instead
    verify = {
      subject = var.cluster.keyed ? null : var.signed_identity_subject
      keyed   = var.cluster.keyed
    }
  }

  vars       = merge(var.extra_vars, local.vars)
  namespaces = ["ktiro"]
}
