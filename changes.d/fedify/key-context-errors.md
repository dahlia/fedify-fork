---
links:
  '#1267': https://github.com/fedify-dev/fedify/issues/1267
  '#1271': https://github.com/fedify-dev/fedify/pull/1271
---
 -  Fixed signature key lookups throwing on malformed remote JSON-LD contexts
    or unavailable context URLs.  Unverifiable keys now return `null`, and
    context transport failures are retried rather than cached as invalid keys.
    [[#1267], [#1271]]
