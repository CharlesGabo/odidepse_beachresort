<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZammerBreeze Beach Resort</title>
    <!-- Load React. -->
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <!-- Load Babel to let us write JSX in the browser -->
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body {
            font-family: sans-serif;
            padding: 40px;
            margin: 0;
        }

        button {
            padding: 10px 15px;
            margin-top: 10px;
            cursor: pointer;
        }
    </style>
</head>

<body>
    <div id="root"></div>

    <script type="text/babel">
        function App() {
            const testBackend = async () => {
                try {
                    const response = await fetch('api/hello.php');
                    const data = await response.json();
                    alert('Server says: ' + data.message);
                } catch (e) {
                    alert('Error connecting to backend: ' + e.message);
                }
            };

            return (
                <div>
                    <h1>Welcome to ZammerBreeze Beach Resort</h1>
                    <p>React is loading directly in XAMPP! No Node.js or Vite needed.</p>
                    <button onClick={testBackend}>Test PHP Backend</button>
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>

</html>