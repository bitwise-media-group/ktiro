# ktiro: a prototype of an end-to-end, intent-driven software factory.
#
# Everything lives in mise tasks: the node archetype and the common tasks come
# from the shared toolchain submodule at .mise/, selected in the root
# mise.toml; tasks.toml carries the repo-local tasks. This Makefile is only the
# thin forwarding shim: `make <task>` == `mise run <task>`.
MISE_TASKS += dev screenshots
include .mise/archetypes/node/include.mk
