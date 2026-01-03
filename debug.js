const http = require('http');

async function testAllEndpoints() {
  const baseUrl = 'http://localhost:4000';
  
  console.log('Testing all endpoints...\n');
  
  const endpoints = [
    { method: 'GET', path: '/', description: 'Root endpoint' },
    { method: 'GET', path: '/health', description: 'Health check' },
    { method: 'GET', path: '/api/test', description: 'Main server test' },
    { method: 'GET', path: '/api/users/public-test', description: 'Users public test' },
    { method: 'GET', path: '/api/users/test', description: 'Users test' },
    { method: 'GET', path: '/api/users/health', description: 'Users health' },
    { method: 'GET', path: '/api/users/profile', description: 'Profile (needs auth)' },
  ];

  for (const endpoint of endpoints) {
    console.log(`Testing: ${endpoint.description}`);
    console.log(`  ${endpoint.method} ${baseUrl}${endpoint.path}`);
    
    try {
      const options = {
        hostname: 'localhost',
        port: 4000,
        path: endpoint.path,
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (endpoint.path === '/api/users/profile') {
        options.headers['Authorization'] = 'Bearer test-token-123';
      }

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`  Status: ${res.statusCode} ${res.statusMessage}`);
          if (data) {
            try {
              const json = JSON.parse(data);
              console.log(`  Response: ${JSON.stringify(json, null, 2).substring(0, 200)}...`);
            } catch {
              console.log(`  Response: ${data.substring(0, 200)}...`);
            }
          }
          console.log('');
        });
      });

      req.on('error', (error) => {
        console.log(`  ❌ Error: ${error.message}`);
        console.log('');
      });

      req.end();
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`  ❌ Exception: ${error.message}`);
      console.log('');
    }
  }
}

testAllEndpoints();