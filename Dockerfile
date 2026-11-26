# Copyright 2026 BitWise Media Group Ltd
# SPDX-License-Identifier: MIT

# The ktiro image, built by `patchy build` (patchy.yaml) for linux/amd64 and
# linux/arm64. The builder runs on the build host's own platform: it builds
# the single-file page (build.ts), then cross-compiles server.ts into one
# self-contained binary for the target (bun build --compile --target), so an
# arm64 image never builds under emulation. VERSION and COMMIT arrive as build
# args from patchy.yaml and surface at /_/version.
#
# distroless cc is the whole runtime: a compiled bun binary needs only glibc.
# Runs as uid 65532 ("nonroot") under readOnlyRootFilesystem - the page is
# read and compressed into memory at start-up.

FROM --platform=$BUILDPLATFORM oven/bun:1.4.5-slim@sha256:b780593f3e10918cbdaec3d5a08d52224b9198069a65eb47812085c2ec007643 AS build

ARG TARGETARCH

WORKDIR /src
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY tsconfig.json build.ts index.html server.ts ./
COPY src/ src/
RUN bun build.ts

# x64-baseline runs on every amd64 CPU (no AVX2 requirement on older nodes).
RUN case "$TARGETARCH" in \
      amd64) target=bun-linux-x64-baseline ;; \
      arm64) target=bun-linux-arm64 ;; \
      *) echo "unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && bun build server.ts --compile --minify --target="$target" --outfile /out/ktiro

FROM gcr.io/distroless/cc-debian13:nonroot@sha256:29ee70762214fe8190cea04ef1c0a84a8365879e047ce8f911ae5a5ab2355fa2

ARG VERSION=dev
ARG COMMIT=unknown
ENV KTIRO_VERSION=$VERSION \
    KTIRO_COMMIT=$COMMIT \
    KTIRO_PAGE=/srv/ktiro/index.html

COPY --from=build /out/ktiro /usr/local/bin/ktiro
COPY --from=build /src/dist/index.html /srv/ktiro/index.html

USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/ktiro"]
