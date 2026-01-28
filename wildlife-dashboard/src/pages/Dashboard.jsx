import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import { testBackendConnection } from '../services/api';

const Dashboard = () => {
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkBackend();
  }, []);

  const checkBackend = async () => {
    setLoading(true);
    const result = await testBackendConnection();
    setBackendStatus(result);
    setLoading(false);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h3" gutterBottom>
        🐾 Wildlife Alert Dashboard
      </Typography>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            System Status
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={24} />
              <Typography>Checking backend connection...</Typography>
            </Box>
          ) : backendStatus?.connected ? (
            <Alert severity="success">  
              ✅ Backend connected successfully!
              <Typography variant="body2" sx={{ mt: 1 }}>
                Alerts in database: {backendStatus.data?.alerts_in_db || 0}
              </Typography>
            </Alert>
          ) : (
            <Alert severity="error">
              ❌ Cannot connect to backend
              <Typography variant="body2" sx={{ mt: 1 }}>
                Error: {backendStatus?.error || 'Unknown error'}
              </Typography>
            </Alert>
          )}
          
          <Button 
            variant="outlined" 
            onClick={checkBackend}
            sx={{ mt: 2 }}
          >
            Retry Connection
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Quick Test
          </Typography>
          <Typography paragraph>
            1. Make sure Flask backend is running on port 5000
          </Typography>
          <Typography paragraph>
            2. Open <a href="http://localhost:5000/health" target="_blank">http://localhost:5000/health</a>
          </Typography>
          <Typography paragraph>
            3. Send test alert from Postman to see it appear here
          </Typography>
          
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button variant="contained" color="primary">
              View Alerts
            </Button>
            <Button variant="outlined">
              Open Map
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default Dashboard;