import { useState } from 'react';

const styles = {
  page: {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Arial, sans-serif',
    maxWidth: '720px',
    margin: '48px auto',
    padding: '0 24px',
    lineHeight: 1.6,
  },
  subtitle: {
    color: '#666',
    marginTop: 0,
  },
  button: {
    padding: '10px 18px',
    fontSize: '15px',
    cursor: 'pointer',
    borderRadius: '6px',
    border: '1px solid #888',
    background: 'transparent',
    color: 'inherit',
  },
  meta: {
    marginTop: '24px',
    fontSize: '14px',
  },
  error: {
    marginTop: '24px',
    color: '#c0392b',
  },
};

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const response = await fetch('/api/storage/storage');
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      setData(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <h1>Containerized microservices</h1>
      <p style={styles.subtitle}>
        React &rarr; Nginx &rarr; Storage service &rarr; Auth service &rarr; PostgreSQL
      </p>

      <button style={styles.button} onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch from storage API'}
      </button>

      {error && <p style={styles.error}>Error: {error}</p>}

      {data && (
        <>
          <dl style={styles.meta}>
            <dt>Authorized</dt>
            <dd>{String(data.authorized)}</dd>
            <dt>Storage instance</dt>
            <dd>{data.instance}</dd>
            <dt>Auth instance</dt>
            <dd>{data.auth_instance}</dd>
          </dl>

          <h2>Items from PostgreSQL</h2>
          <ul>
            {data.data.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong> &ndash; {item.description}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
