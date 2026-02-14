import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Typography, Paper } from '@mui/material';

/* ===============================
   FIX LEAFLET DEFAULT ICON PATH
================================ */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* ===============================
   CONSTANTS
================================ */

// Default map center → Anaikatti, Coimbatore
const DEFAULT_CENTER = [11.0816, 76.7813];
const DEFAULT_ZOOM = 12;

// Species → Emoji mapping
const SPECIES_EMOJI_MAP = {
  elephant: '🐘',
  tiger: '🐅',
  leopard: '🐆',
  bear: '🐻',
  wild_boar: '🐗',
  deer: '🦌',
  monkey: '🐒',
  fox: '🦊',
  wolf: '🐺',

  cow: '🐄',
  buffalo: '🐃',
  goat: '🐐',
  sheep: '🐑',
  dog: '🐕',
  cat: '🐈',

  human: '🚶',
  vehicle: '🚗',
  unknown: '❓',
};

/* ===============================
   HELPER FUNCTIONS
================================ */

const normalizeSpecies = (alert) => {
  let species =
    alert?.detection?.species ||
    alert?.detection?.label ||
    alert?.detection?.display_name ||
    'unknown';

  species = species
    .toLowerCase()
    .trim()
    .replace(/[\s-]/g, '_');

  if (species.includes('boar')) species = 'wild_boar';
  if (species.includes('elephant')) species = 'elephant';
  if (species.includes('tiger')) species = 'tiger';
  if (species.includes('leopard')) species = 'leopard';
  if (species.includes('deer')) species = 'deer';
  if (species.includes('human') || species.includes('person')) species = 'human';
  if (species.includes('vehicle') || species.includes('car')) species = 'vehicle';

  return species;
};

const getSpeciesEmoji = (alert) => {
  const key = normalizeSpecies(alert);
  return SPECIES_EMOJI_MAP[key] || SPECIES_EMOJI_MAP.unknown;
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'critical':
      return '#f44336';
    case 'high':
      return '#ff9800';
    case 'medium':
      return '#2196f3';
    default:
      return '#4caf50';
  }
};

const createCustomIcon = (priority, emoji) => {
  const color = getPriorityColor(priority);

  return L.divIcon({
    html: `
      <div style="
        background:${color};
        width:36px;
        height:36px;
        border-radius:50%;
        border:3px solid white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:18px;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
      ">
        ${emoji}
      </div>
    `,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

/* ===============================
   MAP CONTROLLERS
================================ */

// Auto zoom to latest alert
const AutoZoomToLatest = ({ alerts }) => {
  const map = useMap();

  useEffect(() => {
    if (!alerts || alerts.length === 0) return;

    const latest = alerts[0];
    if (!latest?.location?.lat) return;

    map.flyTo(
      [latest.location.lat, latest.location.lng],
      15,
      { animate: true, duration: 1.2 }
    );
  }, [alerts, map]);

  return null;
};

// Zoom to selected alert (from dashboard)
const ZoomToSelected = ({ selectedAlert }) => {
  const map = useMap();

  useEffect(() => {
    if (!selectedAlert?.location) return;

    map.flyTo(
      [selectedAlert.location.lat, selectedAlert.location.lng],
      15,
      { animate: true, duration: 1.2 }
    );
  }, [selectedAlert, map]);

  return null;
};

/* ===============================
   MAIN COMPONENT
================================ */

const RealMap = ({ alerts = [], selectedAlert, height = '650px' }) => {
  const validAlerts = alerts.filter(
    (a) =>
      a?.location?.lat &&
      a?.location?.lng &&
      !isNaN(a.location.lat) &&
      !isNaN(a.location.lng)
  );

  return (
    <Paper sx={{ height, width: '100%', position: 'relative' }}>
      {/* Map Info */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          bgcolor: 'white',
          p: 1.5,
          borderRadius: 1,
          boxShadow: 2,
        }}
      >
        <Typography variant="subtitle2" fontWeight="bold">
          🗺️ Wildlife Map ({validAlerts.length})
        </Typography>
        <Typography variant="caption">
          Default location: Anaikatti, Coimbatore
        </Typography>
      </Box>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AutoZoomToLatest alerts={validAlerts} />
        <ZoomToSelected selectedAlert={selectedAlert} />

        {validAlerts.map((alert) => {
          const isSelected = selectedAlert?.id === alert.id;

          return (
            <Marker
              key={alert.id}
              position={[alert.location.lat, alert.location.lng]}
              icon={createCustomIcon(
                alert.detection?.priority,
                getSpeciesEmoji(alert)
              )}
              zIndexOffset={isSelected ? 1000 : 0}
            >
              <Popup autoPan>
                <Typography fontWeight="bold">
                  {getSpeciesEmoji(alert)} {alert.detection?.display_name}
                </Typography>
                <Typography variant="caption" display="block">
                  Priority: {alert.detection?.priority}
                </Typography>
                <Typography variant="caption" display="block">
                  Confidence:{' '}
                  {(alert.detection?.confidence * 100).toFixed(1)}%
                </Typography>
                <Typography variant="caption" display="block">
                  {alert.location.lat.toFixed(5)}, {alert.location.lng.toFixed(5)}
                </Typography>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </Paper>
  );
};

export default RealMap;
