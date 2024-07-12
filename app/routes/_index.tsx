import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Ty's Raspberry Pi" },
  ];
};

export default function Index() {
  return (
    <div className="font-sans p-4 container mx-auto">
      <h1 className="text-3xl">Ty&apos;s Raspberry Pi</h1>
    </div>
  );
}
