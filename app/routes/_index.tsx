import { json, type MetaFunction } from "@remix-run/node";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

import { visits } from "db/schema";
import { count } from "drizzle-orm";
import { useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Ty's Raspberry Pi" },
  ];
};

export async function loader() {
  const sqlite = new Database("database.db");
  const db = drizzle(sqlite, { logger: true });

  await db.insert(visits).values({
    timestamp: new Date().toISOString(),
  });

  const results = await db.select({ visitsCount: count() }).from(visits);

  const { visitsCount } = results[0];

  return json(visitsCount);
}

export default function Index() {
  const visitsCount = useLoaderData<typeof loader>();

  return (
    <div className="font-sans p-4 container mx-auto">
      <h1 className="text-3xl">Ty&apos;s Raspberry Pi</h1>
      <p>
        This page has been visited {visitsCount} time
        {visitsCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
