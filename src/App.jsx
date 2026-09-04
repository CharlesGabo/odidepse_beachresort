import { useState } from 'react';

export default function App() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const testBackend = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/hello.php', {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setMessage(`Server says: ${data.message}`);
    } catch (error) {
      setMessage(`Error connecting to backend: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main>
      <h1>Welcome to Odidepse Beach Resort</h1>
      <p>React is running with Vite while PHP and MySQL remain on XAMPP.</p>
      <button type="button" onClick={testBackend} disabled={isLoading}>
        {isLoading ? 'Connecting...' : 'Test PHP Backend'}
      </button>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
