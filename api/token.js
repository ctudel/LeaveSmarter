export default async function handler(req, res) {
  const token = process.env.API_TOKEN;
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
