export default function handler(req, res) {
  const token = process.env.API_TOKEN || "";
  res.status(200).json({ token });
}
