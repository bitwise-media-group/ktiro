# ktiro on GKE

Installs the ktiro prototype onto a [terraform-google-gke-flux] cluster as a self-contained application, through that
repo's `modules/application`: the seed (`application-ktiro`), the `ktiro-vars` ConfigMap and the pre-created `ktiro`
namespace. ktiro holds no cloud identity and no state, so there is nothing else to create.

```hcl
module "ktiro" {
  source = "git::https://github.com/bitwise-media-group/ktiro.git//modules/google?ref=<sha>"

  cluster = module.cluster.application_target
}
```

The prototype is served publicly, with no sign-in, at `https://<host>.<PLATFORM_DOMAIN>` (`ktiro` by default). It runs
on demo data only.

| Input                     | Default                                               | What                                                     |
| ------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `cluster`                 | required                                              | the cluster root's `application_target`, verbatim        |
| `host`                    | `ktiro`                                               | the host label (`KTIRO_HOST`)                            |
| `image`                   | `{ channel = "edge", semver = "<1.0.0-0 >=0.0.0-0" }` | which manifests builds the seed follows                  |
| `signed_identity_subject` | this repo's `release.yaml` on `main`                  | the keyless signing identity both images are verified by |
| `extra_vars`              | `{}`                                                  | further `ktiro-vars` keys (not `KTIRO_*`)                |

Outputs: `release`, `vars` and `host`.

[terraform-google-gke-flux]: https://github.com/bitwise-media-group/terraform-google-gke-flux
