export default {
  fetch(request) {
    const token = process.env.API_TOKEN;

    if (!token) {
      return new Response(null, {
        status: 404
      });
    }

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  }
}
