# Copyright 2026 BitWise Media Group Ltd
# SPDX-License-Identifier: MIT

# Plan-time contract tests with mocked google and helm providers: the vars
# contract every manifest substitutes, the edge default, keyed clusters, and
# the input guards.

mock_provider "google" {}

mock_provider "helm" {}

variables {
  # terraform-google-gke-flux's application_target, as a cluster root exports it
  cluster = {
    name              = "ci-test"
    namespace         = "flux-system"
    platform_registry = "us-central1-docker.pkg.dev/ci-test-project/platform"
    tree              = "google"
    issuer            = "^https://token\\.actions\\.githubusercontent\\.com$"
    keyed             = false
    project           = "ci-test-project"
    project_number    = "111111111111"
    workload_pool     = "ci-test-project.svc.id.goog"
    secret_prefix     = "ci-test-"
  }
}

run "defaults" {
  command = plan

  assert {
    condition     = output.vars.KTIRO_HOST == "ktiro"
    error_message = "the default host label is ktiro"
  }

  assert {
    condition     = output.vars.KTIRO_IMAGE_SUBJECT == "^https://github\\.com/bitwise-media-group/ktiro/\\.github/workflows/release\\.yaml@refs/heads/main$"
    error_message = "the image subject defaults to this repo's release workflow on main"
  }

  assert {
    condition     = var.image.channel == "edge"
    error_message = "the seed follows the edge channel by default"
  }
}

run "extra_vars_merge" {
  command = plan

  variables {
    host       = "demo"
    extra_vars = { SOMETHING_ELSE = "x" }
  }

  assert {
    condition     = output.vars.KTIRO_HOST == "demo" && output.vars.SOMETHING_ELSE == "x"
    error_message = "extra_vars merge beside the module's own keys"
  }
}

run "keyed_cluster" {
  command = plan

  variables {
    cluster = {
      name              = "ci-test"
      namespace         = "flux-system"
      platform_registry = "us-central1-docker.pkg.dev/ci-test-project/platform"
      tree              = "google"
      keyed             = true
      project           = "ci-test-project"
      project_number    = "111111111111"
      workload_pool     = "ci-test-project.svc.id.goog"
      secret_prefix     = "ci-test-"
    }
  }
}

run "rejects_owned_extra_vars" {
  command = plan

  variables {
    extra_vars = { KTIRO_HOST = "nope" }
  }

  expect_failures = [var.extra_vars]
}

run "rejects_bad_host" {
  command = plan

  variables {
    host = "Not_A_Label"
  }

  expect_failures = [var.host]
}
