async function gqlRequest(query, variables = {}) {
  const token = getToken();

  if (!token) {
    window.location.href = "/";
    return null;
  }

  const response = await fetch(API.graphql, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  // Token expired
  if (response.status === 401) {
    clearToken();
    window.location.href = "/";
    return null;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json.errors?.length > 0) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}
