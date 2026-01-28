import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const SimpleMapView = ({ alerts, height = '500px' }) => {
  // Filter alerts with valid coordinates
  const validAlerts = alerts.filter(alert => 
    alert.location?.lat && alert.location?.lng
  );

  if (validAlerts.length === 0) {
    return (
      <Box sx={{ 
        height, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: '#f5f5f5',
        borderRadius: 2
      }}>
        <LocationOnIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Map View
        </Typography>
        <Typography color="textSecondary" align="center" sx={{ maxWidth: 400, mb: 3 }}>
          Send alerts with location data to see them on the map.
          Example: {"{"}"location": {"{"}"lat": 12.9716, "lng": 77.5946{"}"}{"}"}
        </Typography>
        
        {/* Simple coordinates display as fallback */}
        {alerts.length > 0 && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'white', borderRadius: 2, width: '100%', maxWidth: 500 }}>
            <Typography variant="subtitle2" gutterBottom>
              Recent Alerts (no map available):
            </Typography>
            {alerts.slice(0, 5).map(alert => (
              <Box key={alert.id} sx={{ mb: 1, p: 1, bgcolor: '#f9f9f9', borderRadius: 1 }}>
                <Typography variant="body2">
                  {alert.detection?.emoji} {alert.detection?.display_name} • 
                  {alert.location?.lat ? ` Lat: ${alert.location.lat.toFixed(4)}` : ' No location'} • 
                  {alert.location?.lng ? ` Lng: ${alert.location.lng.toFixed(4)}` : ''}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // Simple grid of coordinates (temporary until leaflet works)
  return (
    <Box sx={{ height, p: 2, bgcolor: '#f5f5f5', borderRadius: 2, overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocationOnIcon /> Alert Locations ({validAlerts.length})
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 2 }}>
        {validAlerts.map(alert => (
          <Box 
            key={alert.id} 
            sx={{ 
              p: 2, 
              bgcolor: 'white', 
              borderRadius: 2,
              boxShadow: 1,
              borderLeft: `4px solid ${
                alert.detection?.priority === 'critical' ? '#f44336' :
                alert.detection?.priority === 'high' ? '#ff9800' :
                alert.detection?.priority === 'medium' ? '#2196f3' : '#4caf50'
              }`
            }}
          >
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {alert.detection?.emoji || '📍'} {alert.detection?.display_name}
            </Typography>
            
            <Typography variant="body2" color="textSecondary">
              <strong>Coordinates:</strong><br />
              Latitude: {alert.location.lat.toFixed(6)}<br />
              Longitude: {alert.location.lng.toFixed(6)}
            </Typography>
            
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Device:</strong> {alert.device_id}<br />
              <strong>Time:</strong> {new Date(alert.timestamp).toLocaleTimeString()}
            </Typography>
            
            <Button 
              size="small" 
              variant="outlined" 
              sx={{ mt: 1 }}
              href={`https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`}
              target="_blank"
            >
              Open in Google Maps
            </Button>
          </Box>
        ))}
      </Box>
      
      <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
        Note: Install 'leaflet' and 'react-leaflet' for interactive map. Run: npm install leaflet react-leaflet
      </Typography>
    </Box>
  );
};

export default MapView;