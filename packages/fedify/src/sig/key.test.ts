import { mockDocumentLoader, test } from "@fedify/fixture";
import { CryptographicKey, Multikey } from "@fedify/vocab";
import { FetchError, UrlError } from "@fedify/vocab-runtime";
import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  ed25519Multikey,
  rsaPrivateKey2,
  rsaPublicKey1,
  rsaPublicKey2,
  rsaPublicKey3,
} from "../testing/keys.ts";
import {
  exportJwk,
  fetchKey,
  type FetchKeyOptions,
  generateCryptoKeyPair,
  importJwk,
  type KeyCache,
  validateCryptoKey,
} from "./key.ts";

test("validateCryptoKey()", async () => {
  const pkcs1v15 = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  validateCryptoKey(pkcs1v15.privateKey, "private");
  validateCryptoKey(pkcs1v15.privateKey);
  validateCryptoKey(pkcs1v15.publicKey, "public");
  validateCryptoKey(pkcs1v15.publicKey);

  const ed25519 = await crypto.subtle.generateKey(
    "Ed25519",
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;
  validateCryptoKey(ed25519.privateKey, "private");
  validateCryptoKey(ed25519.privateKey);
  validateCryptoKey(ed25519.publicKey, "public");
  validateCryptoKey(ed25519.publicKey);

  assertThrows(
    () => validateCryptoKey(pkcs1v15.privateKey, "public"),
    TypeError,
    "The key is not a public key.",
  );
  assertThrows(
    () => validateCryptoKey(pkcs1v15.publicKey, "private"),
    TypeError,
    "The key is not a private key.",
  );
  assertThrows(
    () => validateCryptoKey(ed25519.privateKey, "public"),
    TypeError,
    "The key is not a public key.",
  );
  assertThrows(
    () => validateCryptoKey(ed25519.publicKey, "private"),
    TypeError,
    "The key is not a private key.",
  );

  const ecdsa = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  );
  assertThrows(
    () => validateCryptoKey(ecdsa.publicKey),
    TypeError,
    "only RSASSA-PKCS1-v1_5 and Ed25519",
  );

  const pkcs1v15Sha512 = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-512",
    },
    true,
    ["sign", "verify"],
  );
  assertThrows(
    () => validateCryptoKey(pkcs1v15Sha512.privateKey),
    TypeError,
    "hash algorithm for RSASSA-PKCS1-v1_5 keys must be SHA-256",
  );
});

test("generateCryptoKeyPair()", async () => {
  const rsaKeyPair = await generateCryptoKeyPair();
  assertEquals(
    rsaKeyPair.privateKey.algorithm as unknown,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-256",
      },
      modulusLength: 4096,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    },
  );
  validateCryptoKey(rsaKeyPair.privateKey, "private");
  validateCryptoKey(rsaKeyPair.publicKey, "public");

  const rsaKeyPair2 = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
  assertEquals(
    rsaKeyPair2.privateKey.algorithm as unknown,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: {
        name: "SHA-256",
      },
      modulusLength: 4096,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    },
  );
  validateCryptoKey(rsaKeyPair2.privateKey, "private");
  validateCryptoKey(rsaKeyPair2.publicKey, "public");

  const ed25519KeyPair = await generateCryptoKeyPair("Ed25519");
  assertEquals(ed25519KeyPair.privateKey.algorithm, { name: "Ed25519" });
  validateCryptoKey(ed25519KeyPair.privateKey, "private");
  validateCryptoKey(ed25519KeyPair.publicKey, "public");
});

const rsaPublicJwk: JsonWebKey = {
  alg: "RS256",
  kty: "RSA",
  // cSpell: disable
  e: "AQAB",
  n: "oRmBtnxbdFutoRd1GLGwwGTrsqlRRWUe11hHQaoRLGf5LwQ0tIc6I9q-dynliw-2kxYsL" +
    "n9SH2je6HcTYOolgW7F_cOWXZQN04b-OiYcU1ConAhLjmn4k1uKawJ614y0ScPNd8PQ-Cl" +
    "jsnlPxbq9ofaCMe2BV3B6y09aCuGFJ0nxn1_ubjmIBIWWFTAznoz1J9BhJDGyt3IO3ABy3" +
    "f9zDVlR32L_n5VIkXnxkjUKdzMAOzYb62kuKOp1iznRTPrV71SNtivJMwSh_LVgBrmZjtI" +
    "n_oim-KyX_fdLU3tQ7VClyqmJzyAjccOH6Qj6nFTPh-vX07gqN8IlLT2uye4waw",
  // cSpell: enable
  key_ops: ["verify"],
  ext: true,
};

const rsaPrivateJwk: JsonWebKey = {
  alg: "RS256",
  kty: "RSA",
  // cSpell: disable
  d: "f-Pa2L7Sb4YUSa1wlSEC-0li35uQ3DFRkY0QTG2xYnpMFGoXWTV9D1epGrqU8pePzias" +
    "_mCvFiZPx2Y4aRiYm68P2Mu7hCBz9XfWPN1iYTXIFM51BOLVpk3mjdsTICkgOusJI0m9j" +
    "DR3ZAjwLj14K6qhYvd0VbECmoItLjQoW64Sc9iDgD3CvGoTqv71oTfW70cy-Ve1xQ9CTh" +
    "AmMOTKe6rYCUTA8tMZcPszifZ4iOasOjgvRxyel86LqGNtyslY8k86gQlMtFpR3VeZV_8" +
    "otAWZn0mDc4vVU8HUO-DzYiIFdAcVxfPJh6tx7snCTsdzze_98OEAK4EWYBn7vsGFeQ",
  dp: "lrXReSkZQXSmSxQ1TimV5kMt96gSu4_r-OGIabVmoG5irhjMyN08Jjc3qK9oZS3uNM-Lx" +
    "AOg4OdzefjsF9IMfZJl6wuLd85g_l4BHSaEk5zC8l3QugX1IU9XZ7wDxXUrutMoNtZXDt" +
    "dbveAMtHNZlIu-qmEBDWzkqJiz2WpW-AE",
  dq: "TCLoYcX0ywuNA9DSU6v94KmBh1e_IELEFVbJb5vvLKlAK-ycMK0rfzC1co9Hhkski1Lsk" +
    "TnxnoqwZ5oF-7X10eZvy3Te_FHSl0IsTar8ST2-MRtGh2UjTdvP_nnygj4GcXvKfngjPE" +
    "fthDzVfVMeR38oDhDxMFD5AaY_v9aMH_U",
  e: "AQAB",
  n: "oRmBtnxbdFutoRd1GLGwwGTrsqlRRWUe11hHQaoRLGf5LwQ0tIc6I9q-dynliw-2kxYs" +
    "Ln9SH2je6HcTYOolgW7F_cOWXZQN04b-OiYcU1ConAhLjmn4k1uKawJ614y0ScPNd8PQ-" +
    "CljsnlPxbq9ofaCMe2BV3B6y09aCuGFJ0nxn1_ubjmIBIWWFTAznoz1J9BhJDGyt3IO3A" +
    "By3f9zDVlR32L_n5VIkXnxkjUKdzMAOzYb62kuKOp1iznRTPrV71SNtivJMwSh_LVgBrm" +
    "ZjtIn_oim-KyX_fdLU3tQ7VClyqmJzyAjccOH6Qj6nFTPh-vX07gqN8IlLT2uye4waw",
  p: "xuDd7tE_47NWwvDTpB403X13EPA3768MlNpl_v_BGiuP-1uvWUnsOVZB0F3HXSVg1sBV" +
    "Ntec46v7OU0P693gvYUhouTmSQpayY_VFqMklprWgs7cfneqbeDzv3C4Fw5waY-vjoIND" +
    "sE1jYELUnl5cVjXXyxuGFG-IaLJKmHmHX0",
  q: "z17X2t9zO6WcMp6W04gXdKmniJlxekOrOmWnrX9AwaM8NYCLN3y23r59nqNP9aUAWG1eo" +
    "GFmav2rYQitWhz_VsEu2pQUsfsYKZYHchu5p_jCYwuM3rIg7aCbhtGv_tBoWAf1NvKMhtp" +
    "2es0ZaHZCzKDGSOkIYDOB-ZDmNigWigc",
  qi: "KC6gWhVM_x7iQgl-gEoSh_iM1Jf314ZLJKAAz1DsTHMi5yuCkCMmmY7h6jlkAJVngK3KI" +
    "f5LPoAeUoGJ26E1kocbRU_nZBftMDVXHCYICz8qMQXR5euN_5SeJnu_VWXH-CY83MKhPY" +
    "AorWSZ1-G9gh-C16LlRMzJwoE6h5QNeNo",
  // cSpell: enable
  key_ops: ["sign"],
  ext: true,
};

test("exportJwk()", async () => {
  assertEquals(await exportJwk(rsaPrivateKey2), rsaPrivateJwk);
  assertEquals(await exportJwk(rsaPublicKey2.publicKey!), rsaPublicJwk);
});

test("importJwk()", async () => {
  assertEquals(await importJwk(rsaPrivateJwk, "private"), rsaPrivateKey2);
  assertEquals(
    await importJwk(rsaPublicJwk, "public"),
    rsaPublicKey2.publicKey!,
  );
  assertRejects(() => importJwk(rsaPublicJwk, "private"));
  assertRejects(() => importJwk(rsaPrivateJwk, "public"));
});

test("fetchKey()", async () => {
  const cache: Record<string, CryptographicKey | Multikey | null> = {};
  const options: FetchKeyOptions = {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
    keyCache: {
      get(keyId) {
        return Promise.resolve(cache[keyId.href]);
      },
      set(keyId, key) {
        cache[keyId.href] = key;
        return Promise.resolve();
      },
    } satisfies KeyCache,
  };
  assertEquals(
    await fetchKey("https://example.com/nothing", CryptographicKey, options),
    { key: null, cached: false },
  );
  assertEquals(cache, { "https://example.com/nothing": null });
  assertEquals(
    await fetchKey("https://example.com/nothing", CryptographicKey, options),
    { key: null, cached: true },
  );
  assertEquals(cache, { "https://example.com/nothing": null });
  assertEquals(
    await fetchKey("https://example.com/object", CryptographicKey, options),
    { key: null, cached: false },
  );
  assertEquals(cache, {
    "https://example.com/nothing": null,
    "https://example.com/object": null,
  });
  assertEquals(
    await fetchKey("https://example.com/key", CryptographicKey, options),
    { key: rsaPublicKey1, cached: false },
  );
  assertEquals(cache, {
    "https://example.com/nothing": null,
    "https://example.com/object": null,
    "https://example.com/key": rsaPublicKey1,
  });
  assertEquals(
    await fetchKey("https://example.com/key", CryptographicKey, options),
    { key: rsaPublicKey1, cached: true },
  );
  assertEquals(cache, {
    "https://example.com/nothing": null,
    "https://example.com/object": null,
    "https://example.com/key": rsaPublicKey1,
  });
  assertEquals(
    await fetchKey(
      "https://example.com/person#no-key",
      CryptographicKey,
      options,
    ),
    { key: null, cached: false },
  );
  assertEquals(cache, {
    "https://example.com/nothing": null,
    "https://example.com/object": null,
    "https://example.com/key": rsaPublicKey1,
    "https://example.com/person#no-key": null,
  });
  assertEquals(
    await fetchKey(
      "https://example.com/person2#key3",
      CryptographicKey,
      options,
    ),
    { key: rsaPublicKey3, cached: false },
  );
  assertEquals(cache, {
    "https://example.com/nothing": null,
    "https://example.com/object": null,
    "https://example.com/key": rsaPublicKey1,
    "https://example.com/person#no-key": null,
    "https://example.com/person2#key3": rsaPublicKey3,
  });
  assertEquals(
    await fetchKey(
      "https://example.com/person2#key3",
      CryptographicKey,
      options,
    ),
    { key: rsaPublicKey3, cached: true },
  );
  assertEquals(cache, {
    "https://example.com/nothing": null,
    "https://example.com/object": null,
    "https://example.com/key": rsaPublicKey1,
    "https://example.com/person#no-key": null,
    "https://example.com/person2#key3": rsaPublicKey3,
  });
  assertEquals(
    await fetchKey(
      "https://example.com/person2#key4",
      Multikey,
      options,
    ),
    { key: ed25519Multikey, cached: false },
  );
  assertEquals(cache, {
    "https://example.com/nothing": null,
    "https://example.com/object": null,
    "https://example.com/key": rsaPublicKey1,
    "https://example.com/person#no-key": null,
    "https://example.com/person2#key3": rsaPublicKey3,
    "https://example.com/person2#key4": ed25519Multikey,
  });
  assertEquals(
    await fetchKey(
      "https://example.com/person2#key4",
      Multikey,
      options,
    ),
    { key: ed25519Multikey, cached: true },
  );
  assertEquals(
    await fetchKey("https://example.com/key", CryptographicKey, {
      ...options,
      keyCache: undefined,
    }),
    { key: rsaPublicKey1, cached: false },
  );
  // Discard a fragment if no key is found
  assertEquals(
    await fetchKey(
      "https://example.com/users/handle",
      CryptographicKey,
      options,
    ),
    {
      key: new CryptographicKey({
        id: new URL("https://example.com/users/handle#main-key"),
        publicKey: await importJwk({
          kty: "RSA",
          alg: "RS256",
          // cSpell: disable
          n: "oRmBtnxbdFutoRd1GLGwwGTrsqlRRWUe11hHQaoRLGf5LwQ0tIc6I9q-dynliw-2kxYsLn9SH2je6HcTYOolgW7F_cOWXZQN04b-OiYcU1ConAhLjmn4k1uKawJ614y0ScPNd8PQ-CljsnlPxbq9ofaCMe2BV3B6y09aCuGFJ0nxn1_ubjmIBIWWFTAznoz1J9BhJDGyt3IO3ABy3f9zDVlR32L_n5VIkXnxkjUKdzMAOzYb62kuKOp1iznRTPrV71SNtivJMwSh_LVgBrmZjtIn_oim-KyX_fdLU3tQ7VClyqmJzyAjccOH6Qj6nFTPh-vX07gqN8IlLT2uye4waw",
          e: "AQAB",
          // cSpell: enable
          key_ops: ["verify"],
          ext: true,
        }, "public"),
      }) as CryptographicKey & {
        publicKey: CryptoKey;
      },
      cached: false,
    },
  );
});

test("fetchKey() rejects standalone keys with a mismatched id", async () => {
  for (
    const { keyId, standaloneKey, fetch } of [
      {
        keyId: "https://example.com/key",
        standaloneKey: rsaPublicKey1,
        fetch: (keyId: string, options: FetchKeyOptions) =>
          fetchKey(keyId, CryptographicKey, options),
      },
      {
        keyId: "https://example.com/multikey",
        standaloneKey: ed25519Multikey,
        fetch: (keyId: string, options: FetchKeyOptions) =>
          fetchKey(keyId, Multikey, options),
      },
    ]
  ) {
    const cache: Record<string, CryptographicKey | Multikey | null> = {};
    const options: FetchKeyOptions = {
      async documentLoader(resource) {
        if (resource === keyId) {
          const document = await standaloneKey.toJsonLd({
            contextLoader: mockDocumentLoader,
          });
          return {
            contextUrl: null,
            documentUrl: resource,
            document: {
              ...document as Record<string, unknown>,
              id: "https://example.com/different-key",
            },
          };
        }
        return await mockDocumentLoader(resource);
      },
      contextLoader: mockDocumentLoader,
      keyCache: {
        get(keyId) {
          return Promise.resolve(cache[keyId.href]);
        },
        set(keyId, key) {
          cache[keyId.href] = key;
          return Promise.resolve();
        },
      } satisfies KeyCache,
    };

    assertEquals(await fetch(keyId, options), {
      key: null,
      cached: false,
    });
    assertEquals(cache, { [keyId]: null });
    assertEquals(await fetch(keyId, options), {
      key: null,
      cached: true,
    });
  }
});

test("fetchKey() returns null for a malformed actor publicKey", async () => {
  const actorId = "https://example.com/malformed-public-key";
  const keyId = "https://example.com/malformed-public-key#main-key";
  const cache: Record<string, CryptographicKey | Multikey | null> = {};
  const options: FetchKeyOptions = {
    async documentLoader(resource) {
      if (resource === actorId) {
        return {
          contextUrl: null,
          documentUrl: resource,
          document: {
            "@context": [
              "https://www.w3.org/ns/activitystreams",
              "https://w3id.org/security/v1",
            ],
            id: actorId,
            type: "Person",
            publicKey: keyId,
          },
        };
      }
      if (resource === keyId) {
        return {
          contextUrl: null,
          documentUrl: resource,
          document: {
            "@context": "https://w3id.org/security/v1",
            id: keyId,
            type: "Key",
            owner: actorId,
            publicKeyPem: "not a public key",
          },
        };
      }
      return await mockDocumentLoader(resource);
    },
    contextLoader: mockDocumentLoader,
    keyCache: {
      get(keyId) {
        return Promise.resolve(cache[keyId.href]);
      },
      set(keyId, key) {
        cache[keyId.href] = key;
        return Promise.resolve();
      },
    } satisfies KeyCache,
  };

  assertEquals(await fetchKey(actorId, CryptographicKey, options), {
    key: null,
    cached: false,
  });
  assertEquals(cache, { [actorId]: null });
  assertEquals(await fetchKey(actorId, CryptographicKey, options), {
    key: null,
    cached: true,
  });
});

test("fetchKey() rejects a key whose owner does not link back", async () => {
  // Both sides of the `owner` claim are written by the same host, so the
  // claim is only worth what the named owner's own document says.  Neither
  // impersonated actor below lists the attacker's key.
  // See GHSA-q9f8-5hc7-898f.
  const keyId = "https://attacker.example/key";
  const keyDocument = await rsaPublicKey1.toJsonLd({
    contextLoader: mockDocumentLoader,
  }) as Record<string, unknown>;
  const serveKeyOwnedBy = (owner: string): FetchKeyOptions => ({
    documentLoader(resource) {
      if (resource === keyId) {
        return Promise.resolve({
          contextUrl: null,
          documentUrl: resource,
          document: { ...keyDocument, id: keyId, owner },
        });
      }
      return mockDocumentLoader(resource);
    },
    contextLoader: mockDocumentLoader,
  });

  assertEquals(
    await fetchKey(
      keyId,
      CryptographicKey,
      serveKeyOwnedBy("https://example.com/person"),
    ),
    { key: null, cached: false },
  );
  // The impersonated actor does not even have to be resolvable.
  assertEquals(
    await fetchKey(
      keyId,
      CryptographicKey,
      serveKeyOwnedBy("https://impersonated.invalid/users/victim"),
    ),
    { key: null, cached: false },
  );
});

test("fetchKey() rejects a Multikey whose controller does not link back", async () => {
  const keyId = "https://attacker.example/multikey";
  const keyDocument = await ed25519Multikey.toJsonLd({
    contextLoader: mockDocumentLoader,
  }) as Record<string, unknown>;
  const options: FetchKeyOptions = {
    documentLoader(resource) {
      if (resource === keyId) {
        return Promise.resolve({
          contextUrl: null,
          documentUrl: resource,
          document: {
            ...keyDocument,
            id: keyId,
            controller: "https://example.com/person2",
          },
        });
      }
      return mockDocumentLoader(resource);
    },
    contextLoader: mockDocumentLoader,
  };
  assertEquals(await fetchKey(keyId, Multikey, options), {
    key: null,
    cached: false,
  });
});

test("fetchKey() rejects an actor document from another origin", async () => {
  // A key document dressed up as somebody else's actor document.  The key it
  // carries shares that actor's origin, so the vocabulary trusts it as
  // embedded and never fetches it; the fragmentless key id then takes the
  // single-key fallback below, and the attacker's key comes back attributed
  // to the impersonated actor.  Only the host that serves an actor id can
  // speak for it.  See GHSA-q9f8-5hc7-898f.
  const keyId = "https://attacker.example/key";
  const impersonated = "https://example.com/person";
  const { publicKeyPem } = await rsaPublicKey1.toJsonLd({
    contextLoader: mockDocumentLoader,
  }) as { publicKeyPem: string };
  const options: FetchKeyOptions = {
    documentLoader(resource) {
      if (resource === keyId) {
        return Promise.resolve({
          contextUrl: null,
          documentUrl: resource,
          document: {
            "@context": [
              "https://www.w3.org/ns/activitystreams",
              "https://w3id.org/security/v1",
            ],
            id: impersonated,
            type: "Person",
            publicKey: [
              {
                id: `${impersonated}#main-key`,
                type: "CryptographicKey",
                owner: impersonated,
                publicKeyPem,
              },
            ],
          },
        });
      }
      return mockDocumentLoader(resource);
    },
    contextLoader: mockDocumentLoader,
  };
  assertEquals(await fetchKey(keyId, CryptographicKey, options), {
    key: null,
    cached: false,
  });
});

test("fetchKey() rejects a key that disowns the actor document holding it", async () => {
  // The document is the attacker's own actor document, on the attacker's own
  // origin, but the key inside it points its `owner` at somebody else.
  const actorId = "https://attacker.example/actor";
  const keyId = `${actorId}#main-key`;
  const { publicKeyPem } = await rsaPublicKey1.toJsonLd({
    contextLoader: mockDocumentLoader,
  }) as { publicKeyPem: string };
  const options: FetchKeyOptions = {
    documentLoader(resource) {
      if (resource === keyId || resource === actorId) {
        return Promise.resolve({
          contextUrl: null,
          documentUrl: resource,
          document: {
            "@context": [
              "https://www.w3.org/ns/activitystreams",
              "https://w3id.org/security/v1",
            ],
            id: actorId,
            type: "Person",
            publicKey: [
              {
                id: keyId,
                type: "CryptographicKey",
                owner: "https://example.com/person",
                publicKeyPem,
              },
            ],
          },
        });
      }
      return mockDocumentLoader(resource);
    },
    contextLoader: mockDocumentLoader,
  };
  assertEquals(await fetchKey(keyId, CryptographicKey, options), {
    key: null,
    cached: false,
  });
});

test("fetchKey() records the owner its actor document establishes", async () => {
  const options: FetchKeyOptions = {
    documentLoader: mockDocumentLoader,
    contextLoader: mockDocumentLoader,
  };
  // The key is listed by the actor document it came from but declares no
  // owner of its own.  That single fetch settles the question, so the answer
  // is recorded on the key instead of being left for every caller to redo.
  const { key } = await fetchKey(
    "https://example.com/users/handle#main-key",
    CryptographicKey,
    options,
  );
  assertEquals(key?.ownerId, new URL("https://example.com/users/handle"));
});

test("fetchKey() accepts a key document that leaves its id implicit", async () => {
  const keyId = "https://example.com/key";
  const keyDocument = await rsaPublicKey1.toJsonLd({
    contextLoader: mockDocumentLoader,
  }) as Record<string, unknown>;
  delete keyDocument.id;
  const options: FetchKeyOptions = {
    documentLoader(resource) {
      if (resource === keyId) {
        return Promise.resolve({
          contextUrl: null,
          documentUrl: resource,
          document: keyDocument,
        });
      }
      return mockDocumentLoader(resource);
    },
    contextLoader: mockDocumentLoader,
  };
  const { key } = await fetchKey(keyId, CryptographicKey, options);
  // The URL it was fetched from stands in for the id the document left out,
  // which is what its owner links back to.
  assertEquals(key?.id, new URL(keyId));
  assertEquals(key?.ownerId, new URL("https://example.com/person"));
  assert(key?.publicKey != null);
});

test("fetchKey() records the controller an actor document establishes", async () => {
  const actorId = "https://example.com/multikey-actor";
  const keyId = `${actorId}#assertion`;
  const { publicKeyMultibase } = await ed25519Multikey.toJsonLd({
    contextLoader: mockDocumentLoader,
  }) as { publicKeyMultibase: string };
  const options: FetchKeyOptions = {
    documentLoader(resource) {
      if (resource === actorId || resource === keyId) {
        return Promise.resolve({
          contextUrl: null,
          documentUrl: actorId,
          document: {
            "@context": [
              "https://www.w3.org/ns/activitystreams",
              "https://w3id.org/security/v1",
              "https://w3id.org/security/multikey/v1",
              "https://w3id.org/security/data-integrity/v1",
              "https://www.w3.org/ns/did/v1",
            ],
            id: actorId,
            type: "Person",
            assertionMethod: [
              { id: keyId, type: "Multikey", publicKeyMultibase },
            ],
          },
        });
      }
      return mockDocumentLoader(resource);
    },
    contextLoader: mockDocumentLoader,
  };
  // The same as for a CryptographicKey, but reached through `controller` and
  // `assertionMethod`, which is what the Object Integrity Proof path reads.
  const { key } = await fetchKey(keyId, Multikey, options);
  assertEquals(key?.controllerId, new URL(actorId));
  assert(key?.publicKey != null);
});

for (const cls of [CryptographicKey, Multikey]) {
  test(`fetchKey() rejects malformed contexts for ${cls.name}`, async () => {
    const keyId = new URL("https://example.com/users/alice#main-key");
    const invalidContexts = [
      {
        broken: {
          "@id": "https://example.com/ns#broken",
          "@type": "not-an-absolute-iri",
        },
      },
      "https://example.com/invalid-context",
      "not a url",
      "ctx.jsonld",
      "https://example.com/non-json-context",
      "https://example.com/cyclic-context",
    ];
    for (const context of invalidContexts) {
      const cache: Record<string, CryptographicKey | Multikey | null> = {};
      let loads = 0;
      const options: FetchKeyOptions = {
        documentLoader() {
          loads++;
          return Promise.resolve({
            documentUrl: keyId.href,
            contextUrl: null,
            document: {
              "@context": context,
              id: "https://example.com/users/alice",
              type: "Person",
            },
          });
        },
        contextLoader(resource) {
          return Promise.resolve({
            documentUrl: new URL(resource).href,
            contextUrl: null,
            document: resource.endsWith("non-json-context")
              ? "<html>"
              : resource.endsWith("cyclic-context")
              ? { "@context": resource }
              : 123,
          });
        },
        keyCache: {
          get(id) {
            return Promise.resolve(cache[id.href]);
          },
          set(id, key) {
            cache[id.href] = key;
            return Promise.resolve();
          },
        },
      };
      assertEquals(
        await fetchKey<CryptographicKey | Multikey>(keyId, cls, options),
        { key: null, cached: false },
      );
      assertEquals(cache[keyId.href], null);
      assertEquals(
        await fetchKey<CryptographicKey | Multikey>(keyId, cls, options),
        { key: null, cached: true },
      );
      assertEquals(loads, 1);
    }
  });

  test(`fetchKey() retries context transport failures for ${cls.name}`, async () => {
    const keyId = new URL("https://example.com/users/alice#main-key");
    const contextId = "https://example.com/unavailable-context";
    for (
      const error of [
        new FetchError(contextId),
        new Error("Network connection lost."),
        new TypeError("fetch failed"),
        new TypeError("terminated"),
        new TypeError("error reading a body from connection"),
        globalThis.Object.assign(
          new Error("The socket connection was closed unexpectedly"),
          { code: "ECONNRESET" },
        ),
        globalThis.Object.assign(new Error("Context fetch failed"), {
          name: "jsonld.InvalidUrl",
          details: { code: "loading remote context failed" },
          cause: new FetchError(contextId),
        }),
        new TypeError(
          "error sending request for url (https://example.com/context): connection refused",
        ),
        globalThis.Object.assign(new Error("Unable to connect."), {
          code: "ConnectionRefused",
          errno: -111,
        }),
        ...[
          ["CERT_HAS_EXPIRED", "certificate has expired"],
          ["DEPTH_ZERO_SELF_SIGNED_CERT", "self signed certificate"],
          [
            "SELF_SIGNED_CERT_IN_CHAIN",
            "self signed certificate in certificate chain",
          ],
          [
            "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
            "unable to verify the first certificate",
          ],
        ].map(([code, message]) =>
          globalThis.Object.assign(new Error(message), { code })
        ),
        new DOMException("Timed out", "TimeoutError"),
        new UrlError("DNS lookup failed", { reason: "dns" }),
        new DOMException("Aborted", "AbortError"),
      ]
    ) {
      const cache: Record<string, CryptographicKey | Multikey | null> = {};
      let loads = 0;
      let unavailable = true;
      const key = cls === CryptographicKey
        ? rsaPublicKey1.clone({
          id: keyId,
          owner: new URL("https://example.com/users/alice"),
        })
        : ed25519Multikey.clone({
          id: keyId,
          controller: new URL("https://example.com/users/alice"),
        });
      const keyDocument = await key.toJsonLd({
        contextLoader: mockDocumentLoader,
      });
      const options: FetchKeyOptions = {
        documentLoader() {
          loads++;
          return Promise.resolve({
            documentUrl: keyId.href,
            contextUrl: null,
            document: {
              "@context": [
                contextId,
                "https://www.w3.org/ns/activitystreams",
                "https://w3id.org/security/v1",
                "https://w3id.org/security/multikey/v1",
                "https://www.w3.org/ns/did/v1",
              ],
              id: "https://example.com/users/alice",
              type: "Person",
              ...(cls === CryptographicKey
                ? { publicKey: keyDocument }
                : { assertionMethod: keyDocument }),
            },
          });
        },
        async contextLoader(resource) {
          if (resource === contextId) {
            if (unavailable) throw error;
            return {
              documentUrl: resource,
              contextUrl: null,
              document: { "@context": {} },
            };
          }
          return await mockDocumentLoader(resource);
        },
        keyCache: {
          get(id) {
            return Promise.resolve(cache[id.href]);
          },
          set(id, value) {
            cache[id.href] = value;
            return Promise.resolve();
          },
        },
      };
      assertEquals(
        await fetchKey<CryptographicKey | Multikey>(keyId, cls, options),
        { key: null, cached: false },
      );
      assertEquals(
        await fetchKey<CryptographicKey | Multikey>(keyId, cls, options),
        { key: null, cached: false },
      );
      assertEquals(cache, {});
      assertEquals(loads, 2);
      unavailable = false;
      const recovered = await fetchKey<CryptographicKey | Multikey>(
        keyId,
        cls,
        options,
      );
      assertEquals(recovered.key?.id, keyId);
      assert(recovered.key != null);
      assertEquals(
        await exportJwk(recovered.key.publicKey),
        await exportJwk(key.publicKey!),
      );
      assertEquals(recovered.cached, false);
      assertEquals(loads, 3);
      assertEquals(
        (await fetchKey<CryptographicKey | Multikey>(keyId, cls, options))
          .cached,
        true,
      );
    }
  });

  test(`fetchKey() propagates context loader bugs for ${cls.name}`, async () => {
    for (
      const error of [
        new Error("Loader bug"),
        new ReferenceError("Loader bug"),
        globalThis.Object.assign(new Error("Loader bug"), {
          code: "EACCES",
          errno: -13,
        }),
        new TypeError("Cannot read properties of undefined"),
      ]
    ) {
      const cache: Record<string, CryptographicKey | Multikey | null> = {};
      await assertRejects(() =>
        fetchKey<CryptographicKey | Multikey>("https://example.com/key", cls, {
          documentLoader(resource) {
            return Promise.resolve({
              documentUrl: resource,
              contextUrl: null,
              document: {
                "@context": "https://example.com/context",
                id: resource,
                type: "Person",
              },
            });
          },
          contextLoader() {
            return Promise.reject(error);
          },
          keyCache: {
            get(id) {
              return Promise.resolve(cache[id.href]);
            },
            set(id, value) {
              cache[id.href] = value;
              return Promise.resolve();
            },
          },
        })
      );
      assertEquals(cache, {});
    }
  });
}

for (const cls of [CryptographicKey, Multikey]) {
  test(`fetchKey() handles fallback context errors for ${cls.name}`, async () => {
    for (const failure of ["invalid", "unavailable", "bug"] as const) {
      const key = cls === CryptographicKey ? rsaPublicKey1 : ed25519Multikey;
      const document = await key.toJsonLd({
        contextLoader: mockDocumentLoader,
      });
      const contextId = "https://example.com/fallback-context";
      const cache: Record<string, CryptographicKey | Multikey | null> = {};
      let contextLoads = 0;
      const options: FetchKeyOptions = {
        documentLoader(resource) {
          return Promise.resolve({
            documentUrl: resource,
            contextUrl: null,
            document: {
              ...document as Record<string, unknown>,
              "@context": [
                contextId,
                (document as Record<string, unknown>)["@context"],
              ].flat(),
            },
          });
        },
        async contextLoader(resource) {
          if (resource !== contextId) return await mockDocumentLoader(resource);
          contextLoads++;
          if (contextLoads === 2) {
            if (failure === "unavailable") throw new TypeError("fetch failed");
            if (failure === "bug") throw new Error("Loader bug");
            return { documentUrl: resource, contextUrl: null, document: 123 };
          }
          return {
            documentUrl: resource,
            contextUrl: null,
            document: { "@context": {} },
          };
        },
        keyCache: {
          get(id) {
            return Promise.resolve(cache[id.href]);
          },
          set(id, value) {
            cache[id.href] = value;
            return Promise.resolve();
          },
        },
      };
      if (failure === "bug") {
        await assertRejects(() =>
          fetchKey<CryptographicKey | Multikey>(key.id!, cls, options)
        );
      } else {assertEquals(
          await fetchKey<CryptographicKey | Multikey>(key.id!, cls, options),
          { key: null, cached: false },
        );}
      assertEquals(contextLoads, 2);
      assertEquals(
        cache,
        failure === "invalid" ? { [key.id!.href]: null } : {},
      );
    }
  });

  test(`fetchKey() handles owner context errors for ${cls.name}`, async () => {
    for (const failure of ["invalid", "unavailable", "bug"] as const) {
      const key = cls === CryptographicKey ? rsaPublicKey1 : ed25519Multikey;
      const ownerId = cls === CryptographicKey
        ? rsaPublicKey1.ownerId!
        : ed25519Multikey.controllerId!;
      const document = await key.toJsonLd({
        contextLoader: mockDocumentLoader,
      });
      const cache: Record<string, CryptographicKey | Multikey | null> = {};
      let failed = true;
      const contextId = "https://example.com/owner-context";
      const options: FetchKeyOptions = {
        async documentLoader(resource) {
          if (resource === key.id!.href) {
            return { documentUrl: resource, contextUrl: null, document };
          }
          const owner = await mockDocumentLoader(resource);
          if (resource !== ownerId.href) return owner;
          return {
            ...owner,
            document: {
              ...owner.document as Record<string, unknown>,
              "@context": [
                contextId,
                (owner.document as Record<string, unknown>)["@context"],
              ].flat(),
            },
          };
        },
        async contextLoader(resource) {
          if (resource !== contextId) return await mockDocumentLoader(resource);
          if (failed) {
            if (failure === "unavailable") throw new TypeError("fetch failed");
            if (failure === "bug") throw new Error("Loader bug");
            return { documentUrl: resource, contextUrl: null, document: 123 };
          }
          return {
            documentUrl: resource,
            contextUrl: null,
            document: { "@context": {} },
          };
        },
        keyCache: {
          get(id) {
            return Promise.resolve(cache[id.href]);
          },
          set(id, value) {
            cache[id.href] = value;
            return Promise.resolve();
          },
        },
      };
      if (failure === "bug") {
        await assertRejects(() =>
          fetchKey<CryptographicKey | Multikey>(key.id!, cls, options)
        );
      } else {assertEquals(
          await fetchKey<CryptographicKey | Multikey>(key.id!, cls, options),
          { key: null, cached: false },
        );}
      assertEquals(
        cache,
        failure === "invalid" ? { [key.id!.href]: null } : {},
      );
      if (failure === "unavailable") {
        failed = false;
        assertEquals(
          (await fetchKey<CryptographicKey | Multikey>(key.id!, cls, options))
            .key?.id,
          key.id,
        );
      }
    }
  });
}

for (const cls of [CryptographicKey, Multikey]) {
  test(`fetchKey() retries referenced key context failures for ${cls.name}`, async () => {
    const actorId = new URL("https://example.com/users/alice");
    const keyId = new URL("#main-key", actorId);
    const keyDocumentUrl = "https://example.com/key-document";
    const contextId = "https://example.com/key-context";
    const key = cls === CryptographicKey
      ? rsaPublicKey1.clone({ id: keyId, owner: actorId })
      : ed25519Multikey.clone({ id: keyId, controller: actorId });
    const document = await key.toJsonLd({ contextLoader: mockDocumentLoader });
    const cache: Record<string, CryptographicKey | Multikey | null> = {};
    let unavailable = true;
    let keyLoads = 0;
    const options: FetchKeyOptions = {
      documentLoader(resource) {
        if (resource === keyDocumentUrl) {
          keyLoads++;
          return Promise.resolve({
            documentUrl: resource,
            contextUrl: null,
            document: {
              ...document as Record<string, unknown>,
              "@context": [
                contextId,
                (document as Record<string, unknown>)["@context"],
              ].flat(),
            },
          });
        }
        return Promise.resolve({
          documentUrl: resource,
          contextUrl: null,
          document: {
            "@context": [
              "https://www.w3.org/ns/activitystreams",
              "https://w3id.org/security/v1",
              "https://www.w3.org/ns/did/v1",
            ],
            id: actorId.href,
            type: "Person",
            ...(cls === CryptographicKey
              ? { publicKey: keyDocumentUrl }
              : { assertionMethod: keyDocumentUrl }),
          },
        });
      },
      async contextLoader(resource) {
        if (resource !== contextId) return await mockDocumentLoader(resource);
        if (unavailable) throw new TypeError("fetch failed");
        return {
          documentUrl: resource,
          contextUrl: null,
          document: { "@context": {} },
        };
      },
      keyCache: {
        get(id) {
          return Promise.resolve(cache[id.href]);
        },
        set(id, value) {
          cache[id.href] = value;
          return Promise.resolve();
        },
      },
    };
    assertEquals(
      await fetchKey<CryptographicKey | Multikey>(keyId, cls, options),
      { key: null, cached: false },
    );
    assertEquals(cache, {});
    unavailable = false;
    assertEquals(
      (await fetchKey<CryptographicKey | Multikey>(keyId, cls, options)).key
        ?.id,
      keyId,
    );
    assertEquals(keyLoads, 2);
  });
}

for (const cls of [CryptographicKey, Multikey]) {
  test(`fetchKey() handles string documents for ${cls.name}`, async () => {
    for (const location of ["key", "owner"] as const) {
      for (const failure of ["unavailable", "invalid", "bug"] as const) {
        const key = cls === CryptographicKey ? rsaPublicKey1 : ed25519Multikey;
        const ownerId = cls === CryptographicKey
          ? rsaPublicKey1.ownerId!
          : ed25519Multikey.controllerId!;
        const document = await key.toJsonLd({
          contextLoader: mockDocumentLoader,
        });
        const contextId = "https://example.com/string-document";
        const cache: Record<string, CryptographicKey | Multikey | null> = {};
        let failed = true;
        let contextLoads = 0;
        const options: FetchKeyOptions = {
          async documentLoader(resource) {
            const result = resource === key.id!.href
              ? { documentUrl: resource, contextUrl: null, document }
              : await mockDocumentLoader(resource);
            if (
              failed &&
              resource === (location === "key" ? key.id! : ownerId).href
            ) {
              return { ...result, document: contextId };
            }
            return result;
          },
          async contextLoader(resource) {
            if (resource !== contextId) {
              return await mockDocumentLoader(resource);
            }
            contextLoads++;
            if (failure === "unavailable") throw new FetchError(resource);
            if (failure === "invalid") {
              throw new UrlError("Private address", { reason: "disallowed" });
            }
            throw new Error("Loader bug");
          },
          keyCache: {
            get(id) {
              return Promise.resolve(cache[id.href]);
            },
            set(id, value) {
              cache[id.href] = value;
              return Promise.resolve();
            },
          },
        };
        if (failure === "bug") {
          await assertRejects(
            () => fetchKey<CryptographicKey | Multikey>(key.id!, cls, options),
            Error,
            "Loader bug",
          );
          assertEquals(cache, {});
          assertEquals(contextLoads, 1);
          continue;
        }
        assertEquals(
          await fetchKey<CryptographicKey | Multikey>(key.id!, cls, options),
          { key: null, cached: false },
        );
        assertEquals(
          cache,
          failure === "invalid" ? { [key.id!.href]: null } : {},
        );
        assertEquals(
          await fetchKey<CryptographicKey | Multikey>(key.id!, cls, options),
          { key: null, cached: failure === "invalid" },
        );
        assertEquals(contextLoads, failure === "invalid" ? 1 : 2);
        if (failure === "unavailable") {
          failed = false;
          assertEquals(
            (await fetchKey<CryptographicKey | Multikey>(key.id!, cls, options))
              .key?.id,
            key.id,
          );
        }
      }
    }
  });
}
