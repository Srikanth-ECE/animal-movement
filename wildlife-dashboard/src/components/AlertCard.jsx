import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Collapse
} from '@mui/material';
import {
  ExpandMore,
  LocationOn,
  AccessTime,
  Warning,
  Pets
} from '@mui/icons-material';
import { format } from 'date-fns';

const AlertCard = ({ alert }) => {
  const [expanded, setExpanded] = React.useState(false);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'error';
      case 'viewed': return 'warning';
      case 'resolved': return 'success';
      default: return 'default';
    }
  };

  const formatTime = (timestamp) => {
    try {
      return format(new Date(timestamp), 'MMM dd, HH:mm:ss');
    } catch {
      return 'Unknown time';
    }
  };

  const detection = alert.detection || {};
  const location = alert.location || {};

  return (
    <Card 
      variant="outlined"
      sx={{ 
        borderLeft: `4px solid ${
          detection.priority === 'critical' ? '#f44336' :
          detection.priority === 'high' ? '#ff9800' :
          detection.priority === 'medium' ? '#2196f3' : '#4caf50'
        }`,
        '&:hover': {
          boxShadow: 2,
        }
      }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {detection.emoji || '🐾'} {detection.display_name || 'Unknown'}
            </Typography>
            <Chip 
              label={detection.priority?.toUpperCase() || 'UNKNOWN'} 
              size="small"
              color={getPriorityColor(detection.priority)}
              sx={{ fontWeight: 'bold' }}
            />
            <Chip 
              label={alert.status?.toUpperCase() || 'NEW'} 
              size="small"
              color={getStatusColor(alert.status)}
              variant="outlined"
            />
          </Box>
          
          <IconButton 
            size="small" 
            onClick={() => setExpanded(!expanded)}
            sx={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          >
            <ExpandMore />
          </IconButton>
        </Box>

        {/* Basic Info */}
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTime fontSize="small" />
            {formatTime(alert.timestamp)}
          </Typography>
          
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Pets fontSize="small" />
            Confidence: {(detection.confidence * 100).toFixed(1)}%
          </Typography>
          
          {location.lat && location.lng && (
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationOn fontSize="small" />
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </Typography>
          )}
        </Box>

        {/* Expanded Details */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Device ID
                </Typography>
                <Typography variant="body2">
                  {alert.device_id || 'Unknown'}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Category
                </Typography>
                <Typography variant="body2">
                  {detection.category?.toUpperCase() || 'UNKNOWN'}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Alert ID
                </Typography>
                <Typography variant="body2">
                  #{alert.id}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="textSecondary">
                  Has Image
                </Typography>
                <Typography variant="body2">
                  {alert.has_image ? 'Yes' : 'No'}
                </Typography>
              </Grid>
              
              {alert.acknowledged_by && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">
                    Acknowledged By
                  </Typography>
                  <Typography variant="body2">
                    {alert.acknowledged_by}
                  </Typography>
                </Grid>
              )}
            </Grid>
            
            {/* Action Buttons */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button 
                size="small" 
                variant="outlined" 
                startIcon={<LocationOn />}
              >
                View on Map
              </Button>
              <Button 
                size="small" 
                variant="contained" 
                startIcon={<CheckCircle />}
              >
                Acknowledge
              </Button>
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default AlertCard;