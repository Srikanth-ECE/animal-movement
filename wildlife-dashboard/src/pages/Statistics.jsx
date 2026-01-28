import React from 'react';
import { Container, Typography, Paper } from '@mui/material';

const Statistics = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          📊 Statistics (Coming Soon)
        </Typography>
        <Typography>
          Charts and graphs will be displayed here.
        </Typography>
      </Paper>
    </Container>
  );
};

export default Statistics;