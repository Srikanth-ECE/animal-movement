// src/components/RealMap.jsx
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Typography, Chip, Paper, IconButton } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const RealMap = ({ alerts = [], height = '600px', onRefresh }) => {
  const mapRef = useRef(null);
  
  // Filter alerts with valid coordinates
  const validAlerts = alerts.filter(alert => 
    alert?.location?.lat && alert?.location?.lng &&
    !isNaN(alert.location.lat) && !isNaN(alert.location.lng)
  );

  // Calculate center of all alerts
  const calculateCenter = () => {
    if (validAlerts.length === 0) return [12.9716, 77.5946]; // Default: Bangalore
    
    const avgLat = validAlerts.reduce((sum, a) => sum + a.location.lat, 0) / validAlerts.length;
    const avgLng = validAlerts.reduce((sum, a) => sum + a.location.lng, 0) / validAlerts.length;
    return [avgLat, avgLng];
  };

  // Priority-based marker styling
  const getMarkerStyle = (priority) => {
    switch(priority) {
      case 'critical':
        return { color: '#ff0000', size: 40, emoji: '🔴' };
      case 'high':
        return { color: '#ff8800', size: 36, emoji: '🟠' };
      case 'medium':
        return { color: '#0077ff', size: 32, emoji: '🔵' };
      default:
        return { color: '#00aa00', size: 28, emoji: '🟢' };
    }
  };

  // Create custom icon
  const createCustomIcon = (priority, speciesEmoji = '🐾') => {
    const style = getMarkerStyle(priority);
    
    return L.divIcon({
      html: `
        <div style="
          background-color: ${style.color};
          width: ${style.size}px;
          height: ${style.size}px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: ${style.size * 0.5}px;
          font-weight: bold;
          cursor: pointer;
        ">
          ${speciesEmoji}
        </div>
      `,
      className: 'custom-marker',
      iconSize: [style.size, style.size],
      iconAnchor: [style.size / 2, style.size / 2],
      popupAnchor: [0, -style.size / 2]
    });
  };

  // Danger zone circles (simulated)
  const dangerZones = [
    { center: [12.9716, 77.5946], radius: 500, label: 'Village Perimeter' },
    { center: [12.9666, 77.5896], radius: 300, label: 'Farm Area' },
  ];

  if (validAlerts.length === 0) {
    return (
      <Box sx={{ 
        height, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: '#f5f5f5',
        borderRadius: 2,
        p: 3
      }}>
        <LocationOnIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          🗺️ Wildlife Monitoring Map
        </Typography>
        <Typography color="textSecondary" align="center" sx={{ maxWidth: 400, mb: 2 }}>
          Alerts with GPS coordinates will appear here for real-time monitoring.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mb: 3 }}>
          <Chip label="Critical 🔴" sx={{ bgcolor: '#ffebee', fontWeight: 'bold' }} />
          <Chip label="High 🟠" sx={{ bgcolor: '#fff3e0' }} />
          <Chip label="Medium 🔵" sx={{ bgcolor: '#e3f2fd' }} />
          <Chip label="Low 🟢" sx={{ bgcolor: '#e8f5e9' }} />
        </Box>
        <Typography variant="caption" color="textSecondary" align="center">
          Install leaflet: <code>npm install leaflet react-leaflet</code>
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, width: '100%', position: 'relative' }}>
      {/* Map Controls */}
      <Paper sx={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        zIndex: 1000,
        p: 1.5,
        display: 'flex',
        gap: 1,
        alignItems: 'center'
      }}>
        <Typography variant="subtitle2" fontWeight="bold">
          🗺️ Active Alerts: {validAlerts.length}
        </Typography>
        <IconButton size="small" onClick={onRefresh}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Paper>

      <MapContainer 
        center={calculateCenter()} 
        zoom={13}
        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
        scrollWheelZoom={true}
        zoomControl={false}
        ref={mapRef}
      >
        <ZoomControl position="topright" />
        
        {/* Base Map Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Satellite Layer (Optional) */}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street Map">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        {/* Danger Zones */}
        {dangerZones.map((zone, index) => (
          <Circle
            key={index}
            center={zone.center}
            radius={zone.radius}
            pathOptions={{
              fillColor: '#ff4444',
              color: '#ff0000',
              fillOpacity: 0.1,
              weight: 2
            }}
          >
            <Popup>
              <strong>⚠️ {zone.label}</strong><br/>
              Restricted Area - High Alert Zone
            </Popup>
          </Circle>
        ))}
        
        {/* Alert Markers */}
        {validAlerts.map((alert) => {
          const position = [alert.location.lat, alert.location.lng];
          const icon = createCustomIcon(
            alert.detection?.priority,
            alert.detection?.emoji || '🐾'
          );

          return (
            <Marker 
              key={alert.id} 
              position={position} 
              icon={icon}
              eventHandlers={{
                click: () => {
                  console.log('Marker clicked:', alert.id);
                }
              }}
            >
              <Popup maxWidth={300}>
                <Box sx={{ p: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" fontWeight="bold">
                      {alert.detection?.emoji} {alert.detection?.display_name || 'Unknown'}
                    </Typography>
                    <Chip 
                      label={alert.detection?.priority?.toUpperCase() || 'UNKNOWN'} 
                      size="small"
                      sx={{ 
                        bgcolor: getMarkerStyle(alert.detection?.priority).color,
                        color: 'white'
                      }}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary">
                    Alert #{alert.id} • {new Date(alert.timestamp).toLocaleTimeString()}
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" display="block">
                      <strong>Confidence:</strong> {(alert.detection?.confidence * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" display="block">
                      <strong>Category:</strong> {alert.detection?.category || 'Unknown'}
                    </Typography>
                    <Typography variant="caption" display="block">
                      <strong>Device:</strong> {alert.device_id}
                    </Typography>
                    <Typography variant="caption" display="block">
                      <strong>Location:</strong> {alert.location.lat.toFixed(6)}, {alert.location.lng.toFixed(6)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <a 
                      href={`https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: '12px',
                        color: '#1976d2',
                        textDecoration: 'none'
                      }}
                    >
                      📍 Open in Google Maps
                    </a>
                  </Box>
                </Box>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <Paper sx={{ 
        position: 'absolute', 
        bottom: 20, 
        right: 20, 
        zIndex: 1000,
        p: 2,
        maxWidth: 180
      }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          🎯 Map Legend
        </Typography>
        {[
          { priority: 'critical', label: 'Critical', color: '#ff0000', emoji: '🔴' },
          { priority: 'high', label: 'High', color: '#ff8800', emoji: '🟠' },
          { priority: 'medium', label: 'Medium', color: '#0077ff', emoji: '🔵' },
          { priority: 'low', label: 'Low', color: '#00aa00', emoji: '🟢' }
        ].map((item) => (
          <Box key={item.priority} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box sx={{ 
              width: 12, 
              height: 12, 
              bgcolor: item.color, 
              borderRadius: '50%', 
              mr: 1,
              border: '1px solid #666'
            }} />
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {item.emoji} {item.label}
            </Typography>
          </Box>
        ))}
        
        {/* Danger Zone Legend */}
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
          <Typography variant="caption" fontWeight="bold" display="block" gutterBottom>
            ⚠️ Danger Zones
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ 
              width: 12, 
              height: 12, 
              border: '2px solid #ff0000',
              borderRadius: '50%', 
              mr: 1,
              opacity: 0.3
            }} />
            <Typography variant="caption">Restricted Areas</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Coordinates Display */}
      {validAlerts.length > 0 && (
        <Paper sx={{ 
          position: 'absolute', 
          top: 60, 
          left: 10, 
          zIndex: 1000,
          p: 2,
          maxHeight: '200px',
          overflow: 'auto',
          maxWidth: '300px'
        }}>
          <Typography variant="caption" fontWeight="bold" gutterBottom>
            📍 Alert Coordinates
          </Typography>
          {validAlerts.slice(0, 5).map(alert => (
            <Box 
              key={alert.id} 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, 
                mb: 1,
                p: 0.5,
                borderRadius: 1,
                '&:hover': { bgcolor: '#f5f5f5' }
              }}
            >
              <Typography variant="caption" sx={{ 
                color: getMarkerStyle(alert.detection?.priority).color,
                fontWeight: 'bold'
              }}>
                {alert.detection?.emoji || '📍'}
              </Typography>
              <Typography variant="caption">
                {alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
};

export default RealMap;