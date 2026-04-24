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
