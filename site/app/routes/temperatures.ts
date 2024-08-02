import { ActionFunctionArgs, json } from "@remix-run/node";

export async function action({request}: ActionFunctionArgs) {
	const formData = await request.formData();
	const updates = Object.fromEntries(formData);

	return json(updates);
}