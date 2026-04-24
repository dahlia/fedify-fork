---
description: >-
  In this tutorial, we will build a small federated image sharing service,
  similar to Pixelfed, using Nuxt and Fedify.  Along the way we'll meet
  actors, inboxes, followers, and the ActivityPub activities that make
  posting an image across the fediverse possible.
---

Creating your own federated image sharing service
=================================================

In this tutorial, we will build a small [Pixelfed]-style federated image
sharing service on top of [Nuxt] and [Fedify]. Like the
[microblog tutorial](./microblog.md), this one focuses on how to use Fedify,
not on the low-level details of the ActivityPub protocol.

The companion repository is available at [fedify-dev/content-sharing]. Each
chapter corresponds to one or two commits there, so you can always compare
your progress with a known-good checkpoint.

If you have any questions, suggestions, or feedback, please join our
[Matrix chat space] or [GitHub Discussions].

[Pixelfed]: https://pixelfed.org/
[Nuxt]: https://nuxt.com/
[Fedify]: https://fedify.dev/
[fedify-dev/content-sharing]: https://github.com/fedify-dev/content-sharing
[Matrix chat space]: https://matrix.to/#/#fedify:matrix.org
[GitHub Discussions]: https://github.com/fedify-dev/fedify/discussions


Target audience
---------------

This tutorial is aimed at people who want to learn how to build
ActivityPub-speaking software with Fedify, using a fullstack web framework
they already know (or would like to learn) rather than a bare HTTP library.

We assume that you can write basic JavaScript and that you're comfortable
with HTML, HTTP, and the command line.  You don't need to know TypeScript,
SQL, Vue, or ActivityPub in advance: we'll introduce them as we go.

You don't need to have built ActivityPub software before, but we do assume
that you've used at least one fediverse service such as [Mastodon],
[Misskey], or Pixelfed itself, so you have a mental picture of the kind of
product we're building.

[Mastodon]: https://joinmastodon.org/
[Misskey]: https://misskey-hub.net/


Goals
-----

We're going to build a single-user service that lets you share photos with
the rest of the fediverse.  By the end of this tutorial, your server will
be able to:

 -  Expose a single user account with a profile page.
 -  Receive follow requests from accounts on other fediverse servers.
 -  Let followers unfollow you.
 -  Show the list of accounts following you.
 -  Upload an image together with a caption and make it a *post*.
 -  Deliver those posts to every follower's inbox across the network.
 -  Let you follow accounts on other servers.
 -  Show the list of accounts you follow.
 -  Show a chronological timeline of posts from accounts you follow.
 -  Let both sides like posts.
 -  Let both sides reply to posts with short comments.

To keep the tutorial focused we'll leave out the following, on purpose:

 -  Profile fields such as bio and avatar cannot be edited.
 -  Once created, an account cannot be deleted.
 -  Posts, likes, and comments cannot be edited or deleted.
 -  No authentication or permission checks.  Anyone who can reach the
    server can post through it.  We'll only use it locally.
 -  No search, no hashtags, no direct messages, no boosts, no stories.

All of these are great follow-up exercises once you've finished the
tutorial.


Setting up the development environment
--------------------------------------

### Installing Node.js

Fedify supports three JavaScript runtimes: [Deno], [Bun], and [Node.js].
We'll use Node.js in this tutorial because Nuxt targets it by default.

> [!TIP]
> A JavaScript runtime is a platform that executes JavaScript code.  Web
> browsers are one kind of JavaScript runtime, and for command-line or
> server use, Node.js is the most common choice.

You need Node.js 22.0.0 or higher.  There are
[various installation methods]; pick whichever suits you best.  Once it's
installed, you'll have the `node` and `npm` commands on your `PATH`:

~~~~ sh
node --version
npm --version
~~~~

[Deno]: https://deno.com/
[Bun]: https://bun.sh/
[Node.js]: https://nodejs.org/
[various installation methods]: https://nodejs.org/en/download/package-manager

### Installing the `fedify` command

To scaffold a Fedify project you need the [`fedify`](../cli.md) command.
There are [several installation methods](../cli.md#installation); the
simplest is to install it globally with `npm`:

~~~~ sh
npm install -g @fedify/cli
~~~~

Check that it is available and on a recent enough version:

~~~~ sh
fedify --version
~~~~

For this tutorial you need 2.2.0 or higher.

### `fedify init` to scaffold the project

Let's pick a directory name for our project.  We'll use *content-sharing*
here.  Run [`fedify init`](../cli.md#fedify-init-initializing-a-fedify-project)
with the directory path (it's fine if the directory doesn't exist yet) and
four flags telling it exactly what kind of project we want:

~~~~ sh
fedify init -w nuxt -p npm -k in-memory -m in-process content-sharing
~~~~

What those flags mean:

`-w nuxt`
:   Generate a [Nuxt] project and wire it up with [`@fedify/nuxt`], Fedify's
    Nuxt integration module.  Nuxt will handle all the HTML pages and
    REST-style endpoints, and `@fedify/nuxt` will take care of ActivityPub
    requests.

`-p npm`
:   Use `npm` as the package manager.  Swap for `pnpm`, `yarn`, or `bun` if
    you prefer.

`-k in-memory`
:   Use an in-memory key–value store for Fedify's caches (e.g., remote
    actor lookups).  This means data disappears when you stop the server,
    which is fine while you're learning.  For production you'd use Redis
    or PostgreSQL.

`-m in-process`
:   Use the in-process message queue to deliver outgoing activities.  Again
    fine for development, but a production deployment would use something
    like Redis or AMQP so that retries survive a restart.

The command installs a few hundred npm packages and prints instructions
for the next step.  Once it's done, your directory should look roughly like
this:

 -  *.vscode/*: editor settings for Biome and ESLint.
 -  *app/*: the Nuxt application directory.
     -  *app.vue*: the root Vue component.
 -  *public/*: static assets served as-is.
 -  *server/*: server-only code.
     -  *federation.ts*: our Fedify `Federation` instance.
     -  *logging.ts*: the [LogTape] logging configuration.
 -  *biome.json*: formatter settings.
 -  *eslint.config.ts*: linter settings.
 -  *nuxt.config.ts*: Nuxt configuration.
 -  *package.json*: project metadata and dependencies.
 -  *tsconfig.json*: TypeScript configuration.

As you can see, the code is TypeScript (the *.ts* and *.vue* files).
We'll cover enough TypeScript as we go; no prior experience is required.

> [!NOTE]
> You might notice that `biome check` complains about the generated
> *biome.json* on a brand-new project because it targets a slightly
> different Biome schema version than the one installed, and because it
> also tries to format the auto-generated *.nuxt/* files. The companion
> repository includes a one-off fix for this in the initial commit; you
> can apply the same tweak by setting `"$schema"` to the version of Biome
> you have installed and adding
> `"files": { "includes": ["**", "!.nuxt/**", "!.output/**", "!dist/**", "!node_modules/**"] }`.

[`@fedify/nuxt`]: https://github.com/fedify-dev/fedify/tree/main/packages/nuxt
[LogTape]: https://logtape.org/

### Running the dev server for the first time

Change into the project directory and start the dev server:

~~~~ sh
cd content-sharing
npm run dev
~~~~

Nuxt picks a free port (usually 3000, or 3001 if 3000 is already taken)
and prints a URL.  Open it in your browser; you should see the default
Nuxt welcome page:

![The default Nuxt welcome page, which we'll replace in the next
chapter.](./content-sharing/nuxt-welcome.png)

We'll replace this welcome page soon, but first let's confirm that Fedify
is already doing its job.  Open a second terminal and ask Fedify to look
up an actor that exists only in-memory on our brand-new server:

~~~~ sh
fedify lookup http://localhost:3000/users/john
~~~~

> [!TIP]
> If Nuxt picked port 3001 because 3000 was taken, adjust the URL
> accordingly (and in every `fedify lookup` or `curl` command later in this
> tutorial).

You should see something like:

~~~~ console
✔ Looking up the object...
Person {
  id: URL "http://localhost:3000/users/john",
  name: "john",
  preferredUsername: "john"
}
~~~~

That means the scaffold already includes a working ActivityPub *actor
dispatcher*, mapped to `/users/{identifier}`.  It returns a `Person`
object whose name and preferred username are both the identifier from the
URL.  We'll change this shortly so that it only returns a real actor when
a matching user exists in our database.

> [!TIP]
> If you'd rather avoid installing the `fedify` command right now, you can
> make the same request with `curl` by sending the `Accept` header that
> ActivityPub clients use:
>
> ~~~~ sh
> curl -H 'Accept: application/activity+json' \
>   http://localhost:3000/users/john | jq .
> ~~~~
>
> The `jq` at the end pretty-prints the JSON-LD response.

Leave the dev server running in one terminal; we'll keep coming back to
it.  Stop it any time with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

### Visual Studio Code

[Visual Studio Code] is the editor we recommend while following this
tutorial.  The generated project ships with editor settings and extension
recommendations for [Biome] (formatter) and [ESLint] (linter), so you
won't have to fight indentation or import order.

> [!WARNING]
> Don't confuse this with Visual Studio.  Visual Studio Code and Visual
> Studio share a brand name but are completely different software.

After [installing Visual Studio Code], open the project directory via
*File* → *Open Folder…*.  If a popup asks whether to install the
recommended Biome and Vue extensions, click *Install*.

> [!TIP]
> If you're a loyal Emacs or Vim user, feel free to stay with your
> favorite editor.  In that case, set up TypeScript LSP and the
> [Volar][Vue LSP] Vue language server so that you get the same inline
> type checking and autocompletion.

*[LSP]: Language Server Protocol

[Visual Studio Code]: https://code.visualstudio.com/
[Biome]: https://biomejs.dev/
[ESLint]: https://eslint.org/
[installing Visual Studio Code]: https://code.visualstudio.com/docs/setup/setup-overview
[Vue LSP]: https://marketplace.visualstudio.com/items?itemName=Vue.volar


Prerequisites
-------------

### TypeScript in a nutshell

Before we start modifying code, let's quickly walk through the parts of
TypeScript we'll actually use.  If you already know TypeScript, skip to
the next section.

TypeScript is JavaScript with static type checking bolted on.  The syntax
is almost the same, with one big addition: you can give variables,
parameters, and function return values an explicit *type*, usually written
after a colon.

~~~~ typescript twoslash
let username: string = "alice";
let followers: number = 0;
~~~~

If you try to put a value of the wrong type into such a variable, Visual
Studio Code will draw a red squiggly line under it before you even run the
program:

~~~~ typescript twoslash
// @errors: 2322
let username: string = 42;
~~~~

A type can be nullable:

~~~~ typescript twoslash
let caption: string | null = null;
caption = "hello";
~~~~

The `?` suffix on a parameter means “this argument is optional”:

~~~~ typescript twoslash
function greet(name: string, greeting?: string): string {
  return `${greeting ?? "Hello"}, ${name}!`;
}
~~~~

You'll mostly be *reading* TypeScript types.  When the tutorial writes
`async (ctx, identifier) => { ... }`, TypeScript will work out the types
of `ctx` and `identifier` for you from the surrounding context.  When
Visual Studio Code disagrees with what we've written, hover over the red
underline and read the message; it usually tells you exactly what is
wrong.

### Vue and Nuxt in a nutshell

Nuxt is a meta-framework built on top of [Vue].  We'll only use a thin
slice of it:

 -  Each file under *app/pages/* becomes a route.  For example,
    `app/pages/users/[username].vue` handles the URL
    `/users/<anything>`.

 -  A page is a [Vue Single-File Component]: one *.vue* file that mixes a
    template, a script, and optional styles.

    ~~~~ vue
    <script setup lang="ts">
    const name = "world";
    </script>

    <template>
      <h1>Hello, {{ name }}!</h1>
    </template>

    <style scoped>
    h1 { color: steelblue; }
    </style>
    ~~~~

 -  Each file under *server/api/* becomes an HTTP endpoint.  For example,
    *server/api/posts.post.ts* handles `POST /api/posts`.

 -  Each file under *server/* that is not inside *api/* is server-only
    code you can import from anywhere on the server (middleware, helper
    modules, our Fedify configuration, etc.).

That's the whole mental model you need for now.  The
[Nuxt documentation][Nuxt] is excellent if you want to go deeper later.

[Vue]: https://vuejs.org/
[Vue Single-File Component]: https://vuejs.org/guide/scaling-up/sfc.html

### What is ActivityPub, roughly?

[ActivityPub] is the protocol that lets Mastodon, Misskey, Pixelfed, and
hundreds of other servers talk to each other as one big network: the
*fediverse*.  Every fediverse account is represented by an *actor* (most
commonly a `Person`), and every action such as following, posting, or
liking is represented by an *activity* (such as `Follow`, `Create(Note)`,
or `Like`).

Servers deliver activities to each other by `POST`ing them to the
recipient's *inbox*.  We'll see that in practice soon; Fedify handles the
HTTP signatures, retries, and so on for us.

[ActivityPub]: https://www.w3.org/TR/activitypub/


A minimal app shell
-------------------

Before we touch Fedify, let's replace the stock Nuxt welcome page with
an app shell that future chapters can hang pages off.  Three files
change: *app/app.vue*, a brand-new *app/pages/index.vue*, and *README.md*.

### `app/app.vue`

Open *app/app.vue* and replace the entire file with:

~~~~ vue [app/app.vue]
<template>
  <div class="app">
    <header class="site-header">
      <NuxtLink to="/" class="site-title">content-sharing</NuxtLink>
    </header>
    <main class="site-main">
      <NuxtPage />
    </main>
  </div>
</template>

<style>
:root {
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-text: #222;
  --color-muted: #6b7280;
  --color-accent: #ff0080;
  --color-border: #e5e7eb;
  --radius: 6px;
  --max-width: 720px;
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.5;
}

a {
  color: var(--color-accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.site-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 0.75rem 1rem;
}

.site-title {
  color: var(--color-text);
  font-weight: 600;
  font-size: 1.1rem;
}

.site-main {
  flex: 1;
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 1.5rem 1rem;
}
</style>
~~~~

The important pieces:

 -  `<NuxtPage />` is Nuxt's router outlet.  Whatever route the visitor
    is on, the matching page from *app/pages/* is rendered here.
 -  The `<style>` block at the bottom isn't `scoped`, so the CSS custom
    properties on `:root` and the `body` resets apply to the whole site.
    Every later page can pick colors, spacing, and radii from these
    variables instead of redefining them.
 -  The visual style is intentionally minimal.  You don't need to copy
    pixel-perfect Pixelfed; a tiny amount of CSS is plenty to make the
    tutorial readable.

> [!TIP]
> The pink `--color-accent` is the only real flourish.  If you'd like
> something different, pick any color you like here and the rest of the
> tutorial will follow along.

### `app/pages/index.vue`

Create the new file *app/pages/index.vue*:

~~~~ vue [app/pages/index.vue]
<template>
  <section class="welcome">
    <h1>Welcome!</h1>
    <p>
      This is a tiny, federated image sharing service built with Nuxt
      and Fedify.  You'll be able to upload images, have people on
      Mastodon or Pixelfed follow you, and see their posts in your
      timeline.
    </p>
    <p>Nothing is wired up yet; the next chapter adds a database.</p>
  </section>
</template>

<style scoped>
.welcome h1 {
  margin-top: 0;
}

.welcome p {
  color: var(--color-muted);
}
</style>
~~~~

Two things to notice:

 -  `<style scoped>` means the CSS only applies to this page's elements,
    even though other pages also have `h1` and `p`.  We'll use `scoped`
    styles for every page from now on.
 -  Because *index.vue* lives at the root of *app/pages/*, it handles
    the URL `/`.  Later we'll add *app/pages/setup.vue* for `/setup`,
    `app/pages/users/[username].vue` for `/users/<anything>`, and so on.

Reload <http://localhost:3000/> (or 3001; adjust as needed) and the stock
Nuxt welcome page is gone.  You should see something like this:

![The new landing page, rendered through <NuxtPage /> from app/pages/index.vue.](./content-sharing/landing-page.png)

### `README.md`

Finally, rewrite *README.md* so the example repo looks inviting on
GitHub.  Copy this in:

~~~~ markdown [README.md]
content-sharing
===============

A tiny, federated image sharing service, built while following the
[_Creating your own federated image sharing service_][tutorial]
tutorial on the Fedify website.

[tutorial]: https://fedify.dev/tutorial/content-sharing


Running it locally
------------------

~~~ sh
npm install
npm run dev
~~~

Nuxt starts on <http://localhost:3000/>.  Expose the port with
`fedify tunnel 3000` in a second terminal to let other fediverse
servers reach you.


License
-------

MIT.
~~~~

That's the whole app shell.  Every subsequent chapter adds exactly the
files that chapter needs and leaves everything else alone, so your diff
in each step stays small and readable.

> [!NOTE]
> All the code in this tutorial is formatted with [Biome], which the
> scaffold already installed.  You don't need to run Biome yourself
> while following along; the snippets are pre-formatted.  If you do
> want to reformat later, run `npx biome check --write .` at the root
> of the project.


Setting up the database
-----------------------

Our app needs a place to put accounts, follows, posts, comments, and
likes.  We'll use [SQLite] because it's a single file (nothing to
install, nothing to configure), and [Drizzle ORM] because it lets us
describe the schema as TypeScript and gives every query a precise row
type without having to learn a query builder's DSL.

[SQLite]: https://sqlite.org/
[Drizzle ORM]: https://orm.drizzle.team/

### Installing the packages

Install the runtime packages and Drizzle's CLI (drizzle-kit) at once:

~~~~ sh
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3
~~~~

What each of these does:

`drizzle-orm`
:   The Drizzle runtime.  We'll use it to build queries in TypeScript.

`better-sqlite3`
:   A synchronous SQLite driver for Node.js.  Drizzle can drive a few
    different SQLite clients; `better-sqlite3` is the most common.

`drizzle-kit`
:   The Drizzle CLI.  It reads our schema file, compares it to the
    database, and pushes any differences as SQL.  Keeping it as a dev
    dependency means it doesn't ship to production.

`@types/better-sqlite3`
:   TypeScript type definitions for `better-sqlite3`, which it doesn't
    bundle itself.  Without this, TypeScript would flag imports from
    `better-sqlite3` as having no type information.

### The schema

Create *server/db/schema.ts*:

~~~~ typescript twoslash [server/db/schema.ts]
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: false }),
    username: text("username").notNull().unique(),
    name: text("name").notNull(),
  },
  (table) => [check("single_user", sql`${table.id} = 1`)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
~~~~

`sqliteTable("users", columns, ...)` declares a table called `users`
with three columns and a constraint.  Each column is a small builder
chain:

`id: integer("id").primaryKey({ autoIncrement: false })`
:   An integer primary key that we'll assign ourselves.  We don't want
    auto-increment because we'll always set `id = 1`.

`username: text("username").notNull().unique()`
:   A non-null, unique text column for the account handle that appears
    in URLs (for example `/users/alice`).

`name: text("name").notNull()`
:   The display name that shows up in the profile header; can be any
    non-empty string.

The third argument is a callback that returns table-level constraints.
We use Drizzle's `check()` helper to add `CHECK (id = 1)` to the
generated SQL.  In plain English: SQLite will refuse any row whose
`id` isn't `1`, which means the table can hold at most one row, which
means our server can host at most one account.  It's a cheap way to
enforce our “single user” rule at the database level, so no amount of
buggy application code can sneak a second user in.

The last two lines expose two TypeScript types:

`User`
:   The shape of a row read from the table (all columns).

`NewUser`
:   The shape of a row we'd `insert`.

We'll use both in later chapters.  The nice thing is that if we change
the schema, both types update automatically; there's no second source
of truth.

> [!TIP]
> Hover over `users` in Visual Studio Code and you'll see the inferred
> table type.  Drizzle's types are worth the price of admission on
> their own.

### The database connection

Create *server/utils/db.ts*:

~~~~ typescript [server/utils/db.ts]
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";

const sqlite = new Database("content-sharing.sqlite3");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
~~~~

The pragmas are SQLite tuning knobs we set once per connection:

`journal_mode = WAL`
:   Puts SQLite into Write-Ahead Logging mode, where readers can
    continue reading while the writer commits.  This matters as soon
    as Fedify's outbox worker and Nuxt's request handlers both touch
    the database at the same time.

`foreign_keys = ON`
:   SQLite doesn't enforce foreign key constraints by default; turning
    it on means that our future `follows`, `posts`, and `comments`
    tables will reject rows that point at missing parents.

`drizzle(sqlite, { schema })` wraps the `better-sqlite3` connection in
a Drizzle client and tells it about our schema.  Every server module
that needs to hit the database just imports this `db`.

> [!TIP]
> Put database-wide helpers like `db` under *server/utils/* instead of
> *server/api/*.  Files in *server/api/* become HTTP endpoints, while
> *server/utils/* is plain importable code.

### The drizzle-kit config

Finally, tell `drizzle-kit` where the schema is and which database to
connect to.  Create *drizzle.config.ts* at the project root:

~~~~ typescript [drizzle.config.ts]
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "content-sharing.sqlite3",
  },
});
~~~~

And add two shortcuts to *package.json*:

~~~~ json [package.json]
{
  "scripts": {
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
~~~~

### Creating the database

With the config in place, ask drizzle-kit to create a fresh
*content-sharing.sqlite3* file matching the schema:

~~~~ sh
npm run db:push
~~~~

You should see something like:

~~~~ console
[✓] Pulling schema from database...
[✓] Changes applied
~~~~

A new *content-sharing.sqlite3* appears at the project root.  It
contains one table (`users`) and nothing else for now.  Every time we
add to *schema.ts*, running `npm run db:push` again diffs the schema
against the existing database and applies just what's changed.

> [!TIP]
> Not interested in what Drizzle generated?  Run `npm run db:studio`
> to open a tiny web UI for browsing rows and schema.  It's a handy
> substitute for the `sqlite3` CLI.

### Gitignoring the database file

The SQLite file is local development state, not source code, and so
are the `-journal`, `-wal`, and `-shm` files SQLite sometimes leaves
next to it.  Add the following block to *.gitignore*:

~~~~ [.gitignore]
# Local database
*.sqlite3
*.sqlite3-journal
*.sqlite3-wal
*.sqlite3-shm
~~~~

Now nothing in the database accidentally ends up in a commit.


Account creation page
---------------------

The database has a shape but no rows.  Let's add a page where someone
visiting our server for the first time can pick a username and a
display name.  Two files carry the feature: the Vue page that shows
the form, and the Nitro endpoint that writes the row.

### The Vue page

Create *app/pages/setup.vue*:

~~~~ vue [app/pages/setup.vue]
<script setup lang="ts">
const username = ref("");
const name = ref("");
const error = ref<string | null>(null);
const submitting = ref(false);

async function submit() {
  submitting.value = true;
  error.value = null;
  try {
    await $fetch("/api/setup", {
      method: "POST",
      body: {
        username: username.value,
        name: name.value,
      },
    });
    await navigateTo("/");
  } catch (e: unknown) {
    submitting.value = false;
    const err = e as { statusMessage?: string };
    error.value = err.statusMessage ?? "Could not set up the account.";
  }
}
</script>

<template>
  <section class="setup">
    <h1>Set up your account</h1>
    <p>
      Pick a username and a display name. The username appears in URLs
      and in your fediverse handle (<code>@you@host</code>), so you
      can't change it later.
    </p>
    <form class="setup-form" @submit.prevent="submit">
      <label>
        <span>Username</span>
        <input
          v-model="username"
          required
          pattern="[A-Za-z0-9_]+"
          maxlength="50"
          autocomplete="off"
        />
      </label>
      <label>
        <span>Display name</span>
        <input v-model="name" required maxlength="100" autocomplete="off" />
      </label>
      <button type="submit" :disabled="submitting">
        {{ submitting ? "Setting up…" : "Create account" }}
      </button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </section>
</template>

<style scoped>
.setup h1 {
  margin-top: 0;
}

.setup > p {
  color: var(--color-muted);
}

.setup-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 320px;
  margin-top: 1rem;
}

.setup-form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
  color: var(--color-muted);
}

.setup-form input {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 1rem;
  color: var(--color-text);
  background: var(--color-surface);
}

.setup-form button {
  padding: 0.5rem 1rem;
  background: var(--color-accent);
  color: #fff;
  border: 0;
  border-radius: var(--radius);
  font-size: 1rem;
  cursor: pointer;
}

.setup-form button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.setup-form .error {
  color: var(--color-accent);
  margin: 0;
}
</style>
~~~~

A few things that are worth calling out:

`ref(...)`
:   Vue's primitive for reactive state.  `username`, `name`,
    `submitting`, and `error` each hold a value that the template
    re-reads whenever it changes.  Read and write them as `.value` in
    script code; in the template you can use them bare.

`v-model="username"`
:   Two-way binds the `<input>` to the `username` ref.  Typing into
    the input updates the ref, which in turn updates anything else
    that reads it.

`@submit.prevent="submit"`
:   Catches the form's submit event, prevents the default full-page
    reload, and calls our `submit` function.

`$fetch(...)`
:   Nuxt's wrapper around `fetch` that automatically handles JSON
    and, on error, throws an error object that carries `statusMessage`
    and `statusCode`.  We read `statusMessage` out of the thrown
    object and show it to the user.

`navigateTo("/")`
:   Nuxt's programmatic navigation helper.  After the server accepts
    the payload we bounce back to the landing page; a later chapter
    will replace that landing page with a proper profile.

The `<style scoped>` block matches the look of the landing page by
reusing the CSS variables from the global `<style>` block in
*app.vue* (`--color-accent`, `--color-border`, `--radius`, and so on).
This is the reuse pattern we'll keep leaning on.

### The server endpoint

Now wire up the endpoint the page talks to.  Nuxt maps files in
*server/api/* to HTTP endpoints: the filename is the path, the suffix
before `.ts` is the method.  So *server/api/setup.post.ts* becomes
`POST /api/setup`.

Create *server/api/setup.post.ts*:

~~~~ typescript [server/api/setup.post.ts]
import { users } from "../db/schema";
import { db } from "../utils/db";

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; name?: string }>(event);
  const username = body?.username?.trim() ?? "";
  const name = body?.name?.trim() ?? "";

  if (!USERNAME_PATTERN.test(username) || username.length > 50) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Username must be 1 to 50 letters, digits, or underscores.",
    });
  }
  if (name === "" || name.length > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: "Display name must be 1 to 100 characters.",
    });
  }

  try {
    db.insert(users).values({ id: 1, username, name }).run();
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: "An account is already set up on this server.",
    });
  }

  return { ok: true };
});
~~~~

Notice that we do not trust the HTML `pattern` and `maxlength`
attributes.  Those are nice for instant feedback in the browser, but
anyone can send a request bypassing them.  The regex check and the
length check here are the ones that actually protect the database.

`db.insert(users).values({ id: 1, username, name }).run()` builds an
`INSERT` statement and executes it synchronously.  If the row already
exists, one of three things fires depending on what went wrong:

 -  The `CHECK (id = 1)` constraint blocks any `id` other than 1 (so
    we can't sneak a second user in by picking a different id).
 -  The `UNIQUE` constraint on `username` blocks a second row even if
    someone tries to insert id=1 twice.
 -  The `PRIMARY KEY` blocks a duplicate id=1.

Drizzle raises in all three cases, and we catch and translate to 409
Conflict so the page can show the friendly message.

> [!TIP]
> Files under *server/utils/* are auto-imported by Nitro, which means
> the `db` import in this file is technically optional.  We keep the
> explicit import so the code reads the same as if you were running it
> outside Nuxt.

### Trying it out

Reload the dev server if it's not running, then visit
<http://localhost:3000/setup>.  An empty form greets you:

![The empty /setup page.](./content-sharing/setup-empty.png)

Fill it in (we'll use `alice` and “Alice Wonderland” throughout the
rest of the tutorial; adjust to taste):

![The /setup form with ‘alice’ and ‘Alice Wonderland’ typed
in.](./content-sharing/setup-filled.png)

Click *Create account* and you land back at `/`.  A new row now
exists in the database; you can verify with `npm run db:studio` or
with `sqlite3 content-sharing.sqlite3 'SELECT * FROM users;'`.

If you go back to `/setup` and try to submit a second account, the
server rejects it and the page shows the error returned from the API:

![The /setup page showing the ‘already set up’ error after a second
submission.](./content-sharing/setup-error.png)

The account exists, but there's still no way to *see* it.  In the
next chapter we'll add a profile page at `/users/<username>`.


Profile page
------------

The account exists, but visiting <http://localhost:3000/users/alice>
still shows a 404.  Let's add the profile page at that URL.  Once
again we'll split it into a page and a tiny API endpoint that reads
the user row.

Why split it?  We'll need to read the same user row from a couple of
other places soon (the actor dispatcher in the next chapter, for
example).  Putting the query in an endpoint means there's one
implementation of “look up a user by username”; the page just calls
`useFetch`.

### The API endpoint

Files in *server/api/* can use square brackets in their filename to
mark dynamic segments.  `server/api/users/[username].get.ts` becomes
`GET /api/users/<whatever>`; Nitro extracts `username` and hands it to
our handler via `getRouterParam`.

Create the file `server/api/users/[username].get.ts`:

~~~~ typescript [server/api/users/[username].get.ts]
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { db } from "../../utils/db";

export default defineEventHandler((event) => {
  const username = getRouterParam(event, "username");
  if (username == null) {
    throw createError({ statusCode: 400, statusMessage: "Missing username." });
  }
  const user = db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (user == null) {
    throw createError({ statusCode: 404, statusMessage: "User not found." });
  }
  return user;
});
~~~~

`db.select().from(users).where(eq(users.username, username))` is the
Drizzle equivalent of `SELECT * FROM users WHERE username = ?`.
`.get()` returns a single row (or `undefined` if nothing matches).

> [!TIP]
> Drizzle's `eq`, `and`, `or`, `sql`, etc. are type-safe builders; if
> you misspell a column name, `tsc` catches it.  Once you've written
> a few queries you'll notice the IDE autocomplete is impressively
> accurate.

### The Vue page

Nuxt page files mirror the same convention: `app/pages/users/[username].vue`
becomes `/users/<anything>`, with `username` available on the route
params.

Create the file `app/pages/users/[username].vue`:

~~~~ vue [app/pages/users/[username].vue]
<script setup lang="ts">
import type { User } from "~~/server/db/schema";

const route = useRoute();
const username = computed(() => route.params.username as string);
const requestUrl = useRequestURL();

const { data: user, error } = await useFetch<User>(
  () => `/api/users/${username.value}`,
);

const handle = computed(() =>
  user.value ? `@${user.value.username}@${requestUrl.host}` : "",
);
</script>

<template>
  <section v-if="user" class="profile">
    <header class="profile-header">
      <h1>{{ user.name }}</h1>
      <p class="handle">{{ handle }}</p>
    </header>
  </section>
  <section v-else-if="error" class="empty">
    <h1>User not found</h1>
    <p>No account named <code>{{ username }}</code> exists on this server.</p>
  </section>
</template>

<style scoped>
.profile-header h1 {
  margin: 0;
}

.handle {
  margin: 0.25rem 0 0;
  color: var(--color-muted);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.95rem;
}

.empty h1 {
  margin-top: 0;
}

.empty code {
  background: var(--color-surface);
  padding: 0.1rem 0.3rem;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
}
</style>
~~~~

Breaking that down:

`import type { User } from "~~/server/db/schema"`
:   Pulls in the row type Drizzle inferred for us in the previous
    chapter.  `~~/` is Nuxt's alias for the project root, so this
    resolves to *server/db/schema.ts*.  The `import type` keeps this
    import types-only; no server code ends up bundled into the browser
    script.

`useRoute()`, `useRequestURL()`
:   Nuxt composables.  `useRoute()` gives us route params; we cast
    `route.params.username` to `string` because Vue Router types it
    more permissively than we need.  `useRequestURL()` returns a
    `URL`-shaped object representing the incoming request; in SSR
    that's the real URL the browser asked for, on the client it's
    derived from `window.location`.

`useFetch<User>(...)`
:   A data-fetching composable that runs on the server during SSR
    and, when the page hydrates in the browser, reuses the payload.
    If the endpoint throws, the `error` ref becomes populated instead
    of `data`.  The `<User>` generic lines our page's view of the
    response up with what the API returns.

`computed(() => ...)`
:   Vue's derived state.  `handle` re-evaluates whenever `user` or
    `requestUrl.host` change, which will matter later when we hit the
    same page with different `username` route params.

`v-if`, `v-else-if`
:   Template conditionals.  When the fetch succeeds we show the
    profile header; when it errors we show the ‘not found’ state.
    There's no explicit loading state because with SSR the data is
    already resolved before the template renders.

### Trying it out

With the dev server still running, visit the URL matching the account
we created:

<http://localhost:3000/users/alice>

The profile header appears with the display name and the fediverse
handle, built from the host in the current URL:

![The /users/alice profile page showing ‘Alice Wonderland’ and the
handle @alice@localhost:3000.](./content-sharing/profile-basic.png)

Try a nonexistent username to exercise the 404 path:

<http://localhost:3000/users/nobody>

![The ‘User not found’ state on
/users/nobody.](./content-sharing/profile-not-found.png)

The handle on the real profile still shows `@alice@localhost:3000`,
which is technically true but useless to the rest of the fediverse:
nobody outside this machine can resolve that hostname.  In a later
chapter we'll run `fedify tunnel` to get a public URL, and the handle
will update itself automatically because `useRequestURL()` reads the
actual request host.

But before anyone on the fediverse can follow Alice, they need to be
able to look Alice up through ActivityPub.  That's the next chapter.


Implementing the actor
----------------------

Everything so far has been plain Nuxt.  Starting with this chapter,
the server finally starts speaking ActivityPub.  We'll tell Fedify
how to look up one of our users and turn the row into an ActivityPub
[`Person`] actor.

[`Person`]: https://www.w3.org/TR/activitystreams-vocabulary/#dfn-person

### One URL, two representations

A Fedify-powered Nuxt app shares a single URL between two audiences:

 -  Browsers that ask for HTML (`Accept: text/html`) go to the Nuxt
    page at `app/pages/users/[username].vue` and see the profile from
    the previous chapter.
 -  Fediverse clients (Mastodon, Misskey, Pixelfed, or `fedify lookup`) ask for
    `application/activity+json`, and `@fedify/nuxt` routes those requests to
    Fedify, which turns the user into a JSON-LD actor document.

The two never conflict because the `@fedify/nuxt` middleware in front
of Nitro sniffs the `Accept` header and decides which side responds.
This is a key reason Nuxt pairs well with Fedify: we don't have to
carve out a separate subdomain or path prefix.

### The actor dispatcher

Open the generated *server/federation.ts* and replace the scaffold
with this:

~~~~ typescript [server/federation.ts]
import {
  createFederation,
  InProcessMessageQueue,
  MemoryKvStore,
} from "@fedify/fedify";
import { Endpoints, Person } from "@fedify/vocab";
import { getLogger } from "@logtape/logtape";
import { eq } from "drizzle-orm";
import { users } from "./db/schema";
import { db } from "./utils/db";

const logger = getLogger("content-sharing");

const federation = createFederation({
  kv: new MemoryKvStore(),
  queue: new InProcessMessageQueue(),
});

federation
  .setActorDispatcher("/users/{identifier}", (ctx, identifier) => {
    const user = db
      .select()
      .from(users)
      .where(eq(users.username, identifier))
      .get();
    if (user == null) return null;

    const actorUri = ctx.getActorUri(identifier);
    return new Person({
      id: actorUri,
      preferredUsername: user.username,
      name: user.name,
      inbox: ctx.getInboxUri(identifier),
      endpoints: new Endpoints({
        sharedInbox: ctx.getInboxUri(),
      }),
      url: actorUri,
    });
  })
  .mapHandle((_ctx, handle) => {
    const user = db
      .select()
      .from(users)
      .where(eq(users.username, handle))
      .get();
    return user == null ? null : handle;
  });

federation.setInboxListeners("/users/{identifier}/inbox", "/inbox");

logger.debug("federation configured");

export default federation;
~~~~

There's a lot going on in that block.  Let's walk through it.

`federation.setActorDispatcher("/users/{identifier}", ...)`
:   Tells Fedify that actors live at URIs shaped like
    `/users/{identifier}`, the same path our Nuxt page already
    handles.  The `{identifier}` placeholder becomes the second
    argument of the callback, so when `/users/alice` is requested
    with an ActivityPub `Accept` header, `identifier` is `"alice"`.

`db.select().from(users).where(eq(users.username, identifier)).get()`
:   Look the user up by username.  Returning `null` when no row
    matches makes Fedify respond with `404 Not Found` for that actor.

`ctx.getActorUri(identifier)`
:   Builds the absolute actor URI for a given identifier on the
    current request.  Passing the same identifier we were given makes
    the returned `id` line up with the incoming URL.

`new Person({ ... })`
:   The ActivityStreams `Person` object.  We fill in:

     -  `id`: the canonical actor URI.
     -  `preferredUsername`: the short handle that appears in
        `@alice@host`.
     -  `name`: the display name.
     -  `inbox`: where other servers POST activities for this actor.
     -  `endpoints.sharedInbox`: an optional server-wide inbox used to
        collapse one delivery per remote server instead of one per
        actor.  We'll need this when delivering to large instances.
     -  `url`: the profile URL a browser should open.  We set it to
        the same URL as `id`; the shared-route design means an actor
        URI is already a human-visitable profile URL.

`.mapHandle((_ctx, handle) => ...)`
:   [WebFinger] lookups arrive as a handle (`alice`, without the
    leading `@`) and need to map back to a dispatcher `{identifier}`.
    Because we chose to use the username as the identifier, the
    mapping is the identity function, but we still check that the row
    exists so a `@ghost@host` lookup returns a clean 404 instead of
    a fake actor.

`federation.setInboxListeners("/users/{identifier}/inbox", "/inbox")`
:   Registers the per-actor inbox URI template and the server-wide
    shared inbox URL.  We pass no handlers yet because no remote
    server will send us an activity before we're reachable over the
    internet.  Later chapters will chain `.on(Follow, ...)`,
    `.on(Undo, ...)`, and friends onto this call to actually process
    activities.  Registering the paths up front is what lets
    `ctx.getInboxUri()` above return real URLs today.

[WebFinger]: https://datatracker.ietf.org/doc/html/rfc7033

### Trying the actor out

With the dev server running, visit `/users/alice` in the browser.
Nothing has changed visually; you still see Alice's profile.  Now try
the same URL but as an ActivityPub client would:

~~~~ sh
fedify lookup http://localhost:3000/users/alice
~~~~

~~~~ console
- Looking up the object...
✔ Fetched object: http://localhost:3000/users/alice
Person {
  id: URL 'http://localhost:3000/users/alice',
  name: 'Alice Wonderland',
  url: URL 'http://localhost:3000/users/alice',
  preferredUsername: 'alice',
  inbox: URL 'http://localhost:3000/users/alice/inbox',
  endpoints: Endpoints { sharedInbox: URL 'http://localhost:3000/inbox' }
}
✔ Successfully fetched the object.
~~~~

Same URL, completely different response.  `fedify lookup` asked for
`application/activity+json`; the `@fedify/nuxt` middleware spotted
that and routed the request to our dispatcher, which pulled Alice out
of SQLite and returned a `Person`.

If you prefer `curl` with `jq`:

~~~~ sh
curl -H 'Accept: application/activity+json' \
  http://localhost:3000/users/alice | jq .
~~~~

And looking up an account that doesn't exist returns 404 as expected:

~~~~ sh
fedify lookup http://localhost:3000/users/nobody
~~~~

~~~~ console
✘ Failed to fetch object.
~~~~

Alice is now discoverable locally, but real fediverse instances need
a cryptographic identity before they'll trust our server.  That's
what we add in the next chapter.


Cryptographic key pairs
-----------------------

Up until now the actor document has been unsigned.  To actually
deliver activities, every request we send has to be signed, and every
object we publish has to carry an integrity proof.  Both of those
require a private key whose matching public key is advertised on the
actor.  Fediverse servers currently use two signing schemes:

 -  **HTTP Signatures** (FEP-521a), using an RSA key pair.  This is
    what Mastodon verifies on every inbound delivery.
 -  **Object Integrity Proofs** (FEP-8b32), using an Ed25519 key pair.
    This is the newer, more compact signature that forwarded objects
    carry.

We want to support both, so each account has two key pairs.

### Storing the keys

Add a `keys` table that keys off `user_id` plus the algorithm name.
Open *server/db/schema.ts* and extend it:

~~~~ typescript twoslash [server/db/schema.ts]
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: false }),
    username: text("username").notNull().unique(),
    name: text("name").notNull(),
  },
  (table) => [check("single_user", sql`${table.id} = 1`)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const keys = sqliteTable(
  "keys",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["RSASSA-PKCS1-v1_5", "Ed25519"] }).notNull(),
    privateKey: text("private_key").notNull(),
    publicKey: text("public_key").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.type] })],
);

export type Key = typeof keys.$inferSelect;
~~~~

What's new:

 -  `userId` is a foreign key into `users.id`.  `onDelete: "cascade"`
    means if we ever delete the user, SQLite drops their keys too.
 -  `type` is constrained to the two algorithm names Fedify knows how
    to generate.  Drizzle's enum column keeps the TypeScript type
    tight.
 -  Both keys are stored as JSON strings of a
    [JSON Web Key][JWK]; we serialize on write with `exportJwk` and
    parse back on read with `importJwk`.  JWK is a compact, standard
    way to store keys.
 -  `primaryKey({ columns: [userId, type] })` makes `(user_id, type)`
    a composite primary key so each user has at most one row per
    algorithm.

Apply the migration:

~~~~ sh
npm run db:push
~~~~

[JWK]: https://datatracker.ietf.org/doc/html/rfc7517

### Generating and serving the keys

Now rewrite *server/federation.ts* to generate the key pairs on
demand and advertise them on the actor:

~~~~ typescript [server/federation.ts]
import {
  createFederation,
  exportJwk,
  generateCryptoKeyPair,
  importJwk,
  InProcessMessageQueue,
  MemoryKvStore,
} from "@fedify/fedify";
import { Endpoints, Person } from "@fedify/vocab";
import { getLogger } from "@logtape/logtape";
import { and, eq } from "drizzle-orm";
import { keys, users } from "./db/schema";
import { db } from "./utils/db";

const logger = getLogger("content-sharing");

const federation = createFederation({
  kv: new MemoryKvStore(),
  queue: new InProcessMessageQueue(),
});

federation
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    const user = db
      .select()
      .from(users)
      .where(eq(users.username, identifier))
      .get();
    if (user == null) return null;

    const actorUri = ctx.getActorUri(identifier);
    const keyPairs = await ctx.getActorKeyPairs(identifier);
    return new Person({
      id: actorUri,
      preferredUsername: user.username,
      name: user.name,
      inbox: ctx.getInboxUri(identifier),
      endpoints: new Endpoints({
        sharedInbox: ctx.getInboxUri(),
      }),
      url: actorUri,
      publicKey: keyPairs[0].cryptographicKey,
      assertionMethods: keyPairs.map((kp) => kp.multikey),
    });
  })
  .mapHandle((_ctx, handle) => {
    const user = db
      .select()
      .from(users)
      .where(eq(users.username, handle))
      .get();
    return user == null ? null : handle;
  })
  .setKeyPairsDispatcher(async (_ctx, identifier) => {
    const user = db
      .select()
      .from(users)
      .where(eq(users.username, identifier))
      .get();
    if (user == null) return [];

    const result: CryptoKeyPair[] = [];
    for (const type of ["RSASSA-PKCS1-v1_5", "Ed25519"] as const) {
      const row = db
        .select()
        .from(keys)
        .where(and(eq(keys.userId, user.id), eq(keys.type, type)))
        .get();
      if (row == null) {
        logger.debug("generating {type} key pair for {username}", {
          type,
          username: user.username,
        });
        const pair = await generateCryptoKeyPair(type);
        db.insert(keys)
          .values({
            userId: user.id,
            type,
            privateKey: JSON.stringify(await exportJwk(pair.privateKey)),
            publicKey: JSON.stringify(await exportJwk(pair.publicKey)),
          })
          .run();
        result.push(pair);
      } else {
        result.push({
          privateKey: await importJwk(JSON.parse(row.privateKey), "private"),
          publicKey: await importJwk(JSON.parse(row.publicKey), "public"),
        });
      }
    }
    return result;
  });

federation.setInboxListeners("/users/{identifier}/inbox", "/inbox");

logger.debug("federation configured");

export default federation;
~~~~

Three new pieces:

`setKeyPairsDispatcher(...)`
:   Fedify calls this whenever it needs to sign something on an
    actor's behalf.  For each algorithm it doesn't yet have, we call
    `generateCryptoKeyPair(type)`, which returns a native `CryptoKeyPair`,
    then `exportJwk(...)` to turn each half into a JWK for storage.
    On subsequent calls we `importJwk(...)` the rows back into
    `CryptoKey` objects.  The two-algorithm loop keeps the code
    symmetrical and keeps the order stable.

`ctx.getActorKeyPairs(identifier)`
:   Inside the actor dispatcher we ask Fedify for the key pairs it's
    about to advertise.  This resolves through the dispatcher above,
    so it both generates missing keys and returns `ActorKeyPair`
    objects that already know their key IDs.

`publicKey` and `assertionMethods` on `Person`
:   `publicKey` is the classic single “main key” field.  We pass the
    RSA pair's `cryptographicKey`, because that's what HTTP Signature
    verifiers look for.  `assertionMethods` is the newer Multikey
    array, and we include every pair's `multikey` so FEP-8b32
    verifiers can pick the one they support.

### Checking the result

Restart the dev server (if you had it running, it probably
hot-reloaded already) and look Alice up again:

~~~~ sh
fedify lookup http://localhost:3000/users/alice
~~~~

You should now see a `publicKey` block and an `assertionMethod` array
(with one `Multikey` per algorithm) in the response.  Those two
fields are the cryptographic identity the rest of the fediverse will
verify when we start signing activities.

> [!NOTE]
> The first look-up is slightly slower because Fedify generates both
> key pairs and writes them to SQLite.  Subsequent requests reuse the
> stored pairs, so they're instant.

Alice is now a fully fledged ActivityPub actor, at least as far as a
local `fedify lookup` is concerned.  Next we'll get our server on the
public internet so Mastodon-powered instances like ActivityPub.Academy
can discover Alice the same way.


Interoperating with the rest of the fediverse
---------------------------------------------

A real fediverse server lives on the open internet at a stable HTTPS
URL.  Our dev server only listens on `localhost:3000`, so no outside
instance can reach it.  We'll fix that with [`fedify tunnel`], which
picks one of a handful of public tunneling services, opens a secure
tunnel from a random HTTPS host back to our local port, and gives us
a URL we can hand out to other instances.

[`fedify tunnel`]: ../cli.md#fedify-tunnel-exposing-a-local-server-to-the-public-internet

### Allowing tunnel hosts through Vite

Before we open the tunnel, Vite needs one small piece of
configuration.  Vite rejects requests whose `Host` header doesn't
match the development server's hostname, which means the tunnel's
random host gets blocked with *Blocked request. This host (“..”) is
not allowed.*

Edit *nuxt.config.ts* to relax that check in development:

~~~~ typescript [nuxt.config.ts]
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@fedify/nuxt"],
  fedify: { federationModule: "#server/federation" },
  ssr: true,
  vite: {
    server: {
      allowedHosts: true,
    },
  },
});
~~~~

`allowedHosts: true` is a development-only setting; it doesn't
affect anything in `nuxt build` output.

### Opening the tunnel

With the dev server running on port 3000 (or 3001, whichever your
copy picked), start the tunnel in a second terminal:

~~~~ sh
fedify tunnel 3000
~~~~

The command prints a URL like:

~~~~ console
- Creating a secure tunnel...
✔ Your local server at 3000 is now publicly accessible:

"https://abc123.lhr.life/"
 Press ^C to close the tunnel.
~~~~

> [!TIP]
> `fedify tunnel` rotates between several free services; if the one
> it picked doesn't respond, Ctrl+C and re-run, or force a specific
> one with `fedify tunnel -s localhost.run 3000` (options:
> `localhost.run`, `serveo.net`, `pinggy.io`).  Tunnels can also drop
> silently if no traffic flows for a while, so keep the command
> visible to spot the next reconnection prompt.

> [!WARNING]
> The tunnel URL is a *random string*, regenerated each time you
> restart the tunnel.  That means restarting the tunnel also moves
> your actor.  Real fediverse servers remember where they found you,
> so every restart effectively creates a new Alice from their point
> of view.  This is fine while you're learning; just don't be
> surprised when a follower from before a restart can't interact
> anymore.

### Looking alice up from outside

Now that Alice is reachable from the internet, any ActivityPub client
can load her actor document.  A quick smoke test from another
terminal:

~~~~ sh
fedify lookup https://abc123.lhr.life/users/alice
~~~~

Replace `abc123.lhr.life` with whatever your tunnel prints.  The
output matches the earlier local lookup, except the `id`, `url`,
`inbox`, and key controller URLs now live on the public tunnel host.

The same URL is what you'd paste into Mastodon's search bar (or any
fediverse client's handle lookup).  If ActivityPub.Academy (a
temporary-account Mastodon instance for experimenting) is up, you
can type `@alice@<your-tunnel-host>` there and follow the actor from
a real browser UI; we cover that interaction in the next chapter.

> [!TIP]
> If ActivityPub.Academy is unreachable at the moment, don't worry:
> we'll also show how to exercise the same flow entirely locally with
> [`fedify inbox`](../cli.md#fedify-inbox-running-an-ephemeral-inbox-server),
> which spins up an ephemeral Mastodon-compatible actor on yet another
> tunnel for a few minutes.


Inbox: receiving follow activities
----------------------------------

With Alice publicly reachable and signed, the next step is to accept
follow requests.  When a remote user clicks *Follow* on Alice, their
server POSTs a `Follow` activity to Alice's inbox; we need to:

1.  Save who the follower is, so Alice can show them on the profile
    and deliver posts to them later.
2.  Reply with an `Accept(Follow)` so the follower's server marks the
    relationship as active.

### Remembering followers

We'll record follows in a new `follows` table.  Each row caches a
few things about the follower we'll need repeatedly (their handle,
display name, inbox URL, shared-inbox URL) so the followers list and
the outbox delivery path don't have to re-fetch the remote actor on
every request.

Extend *server/db/schema.ts*:

~~~~ typescript twoslash [server/db/schema.ts]
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: false }),
    username: text("username").notNull().unique(),
    name: text("name").notNull(),
  },
  (table) => [check("single_user", sql`${table.id} = 1`)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const keys = sqliteTable(
  "keys",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["RSASSA-PKCS1-v1_5", "Ed25519"] }).notNull(),
    privateKey: text("private_key").notNull(),
    publicKey: text("public_key").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.type] })],
);

export type Key = typeof keys.$inferSelect;

export const follows = sqliteTable(
  "follows",
  {
    followingUserId: integer("following_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followerUri: text("follower_uri").notNull(),
    followerHandle: text("follower_handle").notNull(),
    followerName: text("follower_name"),
    followerInbox: text("follower_inbox").notNull(),
    followerSharedInbox: text("follower_shared_inbox"),
    acceptedAt: text("accepted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.followingUserId, table.followerUri] }),
  ],
);

export type FollowRow = typeof follows.$inferSelect;
~~~~

A few notes on the schema:

 -  `(followingUserId, followerUri)` is the composite primary key, so
    the same remote actor can't be recorded as following Alice twice.
 -  `followerInbox` is the URL we POST activities to later; caching
    it means `npm run dev` doesn't re-fetch the actor on every
    delivery.
 -  `followerSharedInbox` is optional because older servers don't
    advertise one; when it's present we can collapse many per-actor
    deliveries into one POST.
 -  The row type is exported as `FollowRow` so it doesn't collide
    with the `Follow` activity class we import from `@fedify/vocab` in
    *server/federation.ts*.

Run `npm run db:push` to create the new table.

### Handling the follow activity

Now extend *server/federation.ts* with a `Follow` handler:

~~~~ typescript [server/federation.ts]
// ...
import {
  createFederation,
  exportJwk,
  generateCryptoKeyPair,
  importJwk,
  InProcessMessageQueue,
  MemoryKvStore,
} from "@fedify/fedify";
import { Accept, Endpoints, Follow, Person } from "@fedify/vocab"; // [!code highlight]
import { getLogger } from "@logtape/logtape";
import { and, eq } from "drizzle-orm";
import { follows, keys, users } from "./db/schema"; // [!code highlight]
import { db } from "./utils/db";
// ...

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      return;
    }
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor") return;
    const identifier = parsed.identifier;
    const user = db
      .select()
      .from(users)
      .where(eq(users.username, identifier))
      .get();
    if (user == null) return;

    const follower = await follow.getActor(ctx);
    if (follower == null || follower.id == null || follower.inboxId == null) {
      return;
    }
    logger.info("{follower} followed {identifier}", {
      follower: follower.id.href,
      identifier,
    });

    const followerHandle =
      `@${follower.preferredUsername}@${follower.id.host}`;
    db.insert(follows)
      .values({
        followingUserId: user.id,
        followerUri: follower.id.href,
        followerHandle,
        followerName: follower.name?.toString() ?? null,
        followerInbox: follower.inboxId.href,
        followerSharedInbox: follower.endpoints?.sharedInbox?.href ?? null,
      })
      .onConflictDoNothing()
      .run();

    await ctx.sendActivity(
      { identifier },
      follower,
      new Accept({
        id: new URL(
          `#accepts/${crypto.randomUUID()}`,
          ctx.getActorUri(identifier),
        ),
        actor: ctx.getActorUri(identifier),
        object: follow,
      }),
    );
  });
~~~~

The handler flow:

 -  `follow.id`, `follow.actorId`, and `follow.objectId` guards drop
    malformed activities with missing required fields.  Treating
    those as no-ops avoids echoing the error back to the sender.
 -  `ctx.parseUri(follow.objectId)` checks that the `object` URI
    points at one of our actors; we ignore follows directed at a
    URL that doesn't belong to our `setActorDispatcher` path.
 -  `follow.getActor(ctx)` fetches the remote actor document.
    Fedify caches the result in the KV store, so repeated follows
    by the same actor won't refetch on every delivery.
 -  The `insert(...).onConflictDoNothing()` chain makes the handler
    idempotent: if the same Follow is redelivered (networks retry
    freely), we don't add a duplicate row or re-send the Accept.
 -  `ctx.sendActivity({ identifier }, follower, new Accept({ ... }))`
    signs and enqueues an `Accept(Follow)` to the follower's inbox.
    The identifier argument tells Fedify which actor (and which of
    its key pairs) to sign with.  We give the Accept a stable
    fragment id anchored under Alice's actor URI so Mastodon's
    stricter verifier accepts it.

### Testing with ActivityPub.Academy (or `fedify inbox`)

With the dev server and the tunnel both running, it's time to send a
real follow request.  The simplest way is to sign up for a throwaway
account on [ActivityPub.Academy], search for Alice's handle there,
and click *Follow*.  Academy is a Mastodon fork that also shows an
*Activity Log* of everything its account has sent and received,
which is perfect for seeing the exact JSON at each step.

![The follow button on Academy's view of Alice, before
clicking.](./content-sharing/ephemeral-inbox-list.png)

> [!TIP]
> Academy tends to be flaky because it's a community-run demo
> instance.  If `https://activitypub.academy/` returns a 5xx error,
> use [`fedify inbox`](../cli.md#fedify-inbox-running-an-ephemeral-inbox-server)
> instead.  That command spins up an ephemeral actor on its own
> tunnel and can send a follow on startup:
>
> ~~~~ sh
> fedify inbox -f https://<your-tunnel-host>/users/alice
> ~~~~
>
> The command prints its own handle, and keeps a web UI running at
> the tunnel URL that shows every activity it received.

Whichever you use, open Alice's database (`npm run db:studio`, or
`sqlite3 content-sharing.sqlite3 'SELECT * FROM follows;'`).  The
Follow handler should have inserted a row pointing at the remote
actor:

~~~~ console
following_user_id  follower_uri                                 followerHandle              ...
1                  https://873d7589e9cb68.lhr.life/i            @i@873d7589e9cb68.lhr.life  ...
~~~~

And on the remote side you'll see the `Accept(Follow)` we sent
back, addressed to Alice's actor URI:

![The ephemeral inbox's view of the Accept(Follow) Alice sent in
response to the Follow.](./content-sharing/ephemeral-inbox-accept.png)

`202 Accepted` on the remote inbox means our signed delivery
worked.  From this moment on, the remote server considers itself an
accepted follower of Alice, and it will deliver the `Create(Note)`
activities we send to its inbox.  We just don't publish any yet.

> [!NOTE]
> Fedify signs the Accept with whichever key pair the remote server
> advertises support for: an HTTP Signature header with our RSA key,
> and a Data Integrity Proof with our Ed25519 key.  Every subsequent
> delivery will reuse the same pairs without any extra work from us.

Next chapter we'll handle the reverse direction: when the remote
actor unfollows Alice.

[ActivityPub.Academy]: https://activitypub.academy/
