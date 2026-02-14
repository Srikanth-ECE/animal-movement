// App.jsx - Wildlife Alert Dashboard (Professional Version)
import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PetsIcon from '@mui/icons-material/Pets';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FilterListIcon from '@mui/icons-material/FilterList';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import Badge from '@mui/material/Badge';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MapIcon from '@mui/icons-material/Map';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ImageIcon from '@mui/icons-material/Image';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import DownloadIcon from '@mui/icons-material/Download';

// Import Map Component
import RealMap from './components/RealMap';
import socketService from './services/socket';

// Create theme
const theme = createTheme({ 
  palette: {
    primary: {
      main: '#1a237e', // Deep blue for professional look
    },
    secondary: {
      main: '#00acc1', // Teal for highlights
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
    },
  },
});

// API Functions
const testBackendConnection = async () => {
  try {
    const response = await fetch('http://localhost:5000/health');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { connected: true, data };
  } catch (error) {
    return { connected: false, error: error.message };
  }
};

const fetchAlerts = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const url = `http://localhost:5000/api/alerts${queryParams ? `?${queryParams}` : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    return { success: true, alerts: data.alerts || [], total: data.total || 0 };
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return { success: false, error: error.message, alerts: [], total: 0 };
  }
};

const acknowledgeAlert = async (alertId, officerName = 'Officer') => {
  try {
    const response = await fetch(`http://localhost:5000/api/alerts/${alertId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'acknowledged',
        acknowledged_by: officerName,
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return false;
  }
};

const getStats = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/stats');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { success: true, stats: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

function App() {
  // State Management
  const [backendStatus, setBackendStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [newAlertsCount, setNewAlertsCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    priority: 'all',
    category: 'all',
    timeframe: '24h',
    minConfidence: 0.7,
  });
  
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Load all data
  const loadData = useCallback(async () => {
    setRefreshing(true);
    
    try {
      // Check backend connection
      const connection = await testBackendConnection();
      setBackendStatus(connection);
      
      if (connection.connected) {
        // Fetch alerts with filters
        const filterParams = {};
        if (filters.priority !== 'all') filterParams.priority = filters.priority;
        if (filters.category !== 'all') filterParams.category = filters.category;
        filterParams.min_confidence = filters.minConfidence;
        
        const alertsResult = await fetchAlerts(filterParams);
        if (alertsResult.success) {
          setAlerts(alertsResult.alerts);
        }
        
        // Fetch statistics
        const statsResult = await getStats();
        if (statsResult.success) {
          setStats(statsResult.stats);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLastUpdate(new Date());
      setLoading(false);
      setRefreshing(false);
      setNewAlertsCount(0);
    }
  }, [filters]);

  // Initialize WebSocket
  useEffect(() => {
    socketService.connect();
    

  // Listen for real-time alerts
  const removeAlertListener = socketService.on('new_alert', (newAlert) => {
    console.log('😂 Real-time alert received:', new Date().toLocaleString());
    console.log('🎯 Species:', newAlert.detection?.species);
    
    setAlerts(prevAlerts => {
      const exists = prevAlerts.some(alert => alert.id === newAlert.id);
      if (exists) return prevAlerts;

      // Increment badge ONLY for new alert
      setNewAlertsCount(prev => prev + 1);

      // Browser notification ONLY for new critical alerts
      if (
        newAlert.detection?.priority === 'critical' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification(
          `🚨 ${newAlert.detection?.display_name || 'Animal'} Detected`,
          {
            body: `Critical alert at ${new Date(
              newAlert.timestamp
            ).toLocaleTimeString()}`,
            icon: '/notification-icon.png',
          }
        );
      }

      return [newAlert, ...prevAlerts];
    });

    // Update last update time
    setLastUpdate(new Date());
  });

  // Check socket connection status
  const interval = setInterval(() => {
    setSocketConnected(socketService.isConnected());
  }, 2000);

  // Initial data load
  loadData();

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Cleanup
  return () => {
    clearInterval(interval);
    removeAlertListener();
    socketService.disconnect();
  };
}, [loadData]);


  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    setSelectedAlert(null); // Clear selected alert when switching tabs
  };

  // Filter change handler
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value,
    }));
  };

  // Acknowledge alert
  const handleAcknowledgeAlert = async (alertId) => {
    const success = await acknowledgeAlert(alertId, 'Forest Officer');
    if (success) {
      // Update local state
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: 'acknowledged', acknowledged_by: 'Forest Officer' }
          : alert
      ));
    }
  };

  // Open image modal
  const handleOpenImageModal = (alert) => {
    setSelectedImage(alert.image_url);
    setSelectedAlert(alert);
    setImageModalOpen(true);
  };

  // Download image
  const handleDownloadImage = (alert) => {
    if (alert.image_url) {
      const link = document.createElement('a');
      link.href = alert.image_url;
      link.download = `wildlife_alert_${alert.id}_${alert.detection?.species || 'unknown'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Filter alerts based on current filters
  const filteredAlerts = alerts.filter(alert => {
    // Priority filter
    if (filters.priority !== 'all' && alert.detection?.priority !== filters.priority) {
      return false;
    }
    
    // Category filter
    if (filters.category !== 'all' && alert.detection?.category !== filters.category) {
      return false;
    }
    
    // Confidence filter
    if (alert.detection?.confidence < filters.minConfidence) {
      return false;
    }
    
    // Timeframe filter
    const alertTime = new Date(alert.timestamp);
    const now = new Date();
    const hoursDiff = (now - alertTime) / (1000 * 60 * 60);
    
    if (filters.timeframe !== 'all') {
      const limits = {
        '1h': 1,
        '24h': 24,
        '7d': 168,
      };

      if (limits[filters.timeframe] && hoursDiff > limits[filters.timeframe]) {
        return false;
      }
    }
    return true;
  });

  // Get alerts with valid coordinates for map
  const alertsWithLocation = filteredAlerts.filter(alert => 
    alert.location?.lat && alert.location?.lng &&
    !isNaN(alert.location.lat) && !isNaN(alert.location.lng)
  );

  // Get critical alerts count
  const criticalAlertsCount = filteredAlerts.filter(
    alert => alert.detection?.priority === 'critical'
  ).length;

  // Get alerts with images count
  const alertsWithImagesCount = alerts.filter(
    alert => alert.has_image || alert.image_url
  ).length;

  // Format time
  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '--';
    }
  };

  // Format full timestamp
  const formatFullTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'Unknown time';
    }
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  // Export alerts to CSV
  const exportAlerts = () => {
    const headers = ['ID', 'Species', 'Priority', 'Confidence', 'Location', 'Timestamp', 'Device', 'Status'];
    const csvRows = [
      headers.join(','),
      ...filteredAlerts.map(alert => [
        alert.id,
        alert.detection?.display_name || 'Unknown',
        alert.detection?.priority || 'unknown',
        (alert.detection?.confidence * 100).toFixed(1) + '%',
        alert.location?.lat ? `${alert.location.lat.toFixed(4)}, ${alert.location.lng.toFixed(4)}` : 'No location',
        new Date(alert.timestamp).toISOString(),
        alert.device_id,
        alert.status || 'new'
      ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wildlife-alerts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {/* Navbar */}
      <Box sx={{ 
        bgcolor: 'primary.main', 
        color: 'white', 
        py: 2, 
        px: 3,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 2
      }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          🌲 Wildlife Monitoring System
          {socketConnected && (
            <Chip 
              label="LIVE"
              size="small"
              sx={{ 
                bgcolor: '#4caf50', 
                color: 'white',
                fontWeight: 'bold',
                animation: 'pulse 2s infinite'
              }}
              icon={<NotificationsActiveIcon sx={{ color: 'white', fontSize: 16 }} />}
            />
          )}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Connection Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {socketConnected ? (
              <WifiIcon sx={{ color: '#4caf50' }} />
            ) : (
              <WifiOffIcon sx={{ color: '#ff5252' }} />
            )}
            <Typography variant="body2">
              {socketConnected ? 'Real-time' : 'Offline'}
            </Typography>
          </Box>
          
          {/* Refresh Button */}
          <Badge 
            badgeContent={newAlertsCount} 
            color="error"
            invisible={newAlertsCount === 0}
          >
            <Button 
              color="inherit" 
              startIcon={<RefreshIcon />}
              onClick={loadData}
              disabled={refreshing}
              variant="outlined"
              size="small"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Badge>
          
          {/* Clear New Alerts */}
          {newAlertsCount > 0 && (
            <Button 
              color="inherit" 
              variant="outlined"
              size="small"
              onClick={() => setNewAlertsCount(0)}
            >
              Clear New ({newAlertsCount})
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabs Navigation */}
      <Paper square sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={currentTab} 
          onChange={handleTabChange}
          centered
          sx={{ 
            bgcolor: '#f8f9fa',
            '& .MuiTab-root': { fontWeight: 600 }
          }}
        >
          <Tab 
            icon={<DashboardIcon />} 
            label={`DASHBOARD (${filteredAlerts.length})`}
          />
          <Tab 
            icon={<MapIcon />} 
            label={`MAP VIEW (${alertsWithLocation.length})`}
          />
        </Tabs>
      </Paper>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ mt: 3, mb: 4 }}>
        
        {/* Filters Bar */}
        <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon /> Filters:
          </Typography>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={filters.priority}
              label="Priority"
              onChange={(e) => handleFilterChange('priority', e.target.value)}
            >
              <MenuItem value="all">All Priorities</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={filters.category}
              label="Category"
              onChange={(e) => handleFilterChange('category', e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              <MenuItem value="wildlife">Wildlife</MenuItem>
              <MenuItem value="livestock">Livestock</MenuItem>
              <MenuItem value="human">Human</MenuItem>
              <MenuItem value="vehicle">Vehicle</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Timeframe</InputLabel>
            <Select
              value={filters.timeframe}
              label="Timeframe"
              onChange={(e) => handleFilterChange('timeframe', e.target.value)}
            >
              <MenuItem value="1h">Last 1 Hour</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="all">All Time</MenuItem>
            </Select>
          </FormControl>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Confidence: ≥{Math.round(filters.minConfidence * 100)}%</Typography>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={filters.minConfidence}
              onChange={(e) => handleFilterChange('minConfidence', parseFloat(e.target.value))}
              style={{ width: 100 }}
            />
          </Box>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Button 
            variant="outlined" 
            size="small"
            onClick={exportAlerts}
          >
            Export CSV
          </Button>
        </Paper>

        {/* Connection Status Alert */}
        {!backendStatus?.connected && !loading && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            action={
              <Button color="inherit" size="small" onClick={loadData}>
                Retry
              </Button>
            }
          >
            Cannot connect to backend server. Make sure Flask is running on port 5000.
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Tab Content */}
        {!loading && (
          <>
            {/* DASHBOARD TAB */}
            {currentTab === 0 && (
              <>
                {/* Stats Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Total Alerts
                        </Typography>
                        <Typography variant="h4">
                          {filteredAlerts.length}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {filters.timeframe === 'all' ? 'All time' : `Last ${filters.timeframe}`}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderLeft: '4px solid #f44336' }}>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Critical Alerts
                        </Typography>
                        <Typography variant="h4" color="error">
                          {criticalAlertsCount}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Requires immediate attention
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ borderLeft: '4px solid #2196f3' }}>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          With Images
                        </Typography>
                        <Typography variant="h4" color="primary">
                          {alertsWithImagesCount}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Captured by cameras
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Last Updated
                        </Typography>
                        <Typography variant="h6">
                          {lastUpdate ? formatTime(lastUpdate) : '--:--'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {lastUpdate ? formatDate(lastUpdate) : '--'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* SINGLE ALERTS LIST - ALL ALERTS TOGETHER */}
                <Paper sx={{ p: 3, boxShadow: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      🚨 Recent Wildlife Alerts
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Showing {filteredAlerts.length} alerts • {alertsWithImagesCount} with images
                    </Typography>
                  </Box>
                  
                  {filteredAlerts.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        No alerts found with current filters
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Try adjusting your filters or check backend connection
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {filteredAlerts.map((alert) => (
                        <Card 
                          key={alert.id} 
                          variant="outlined"
                          sx={{ 
                            borderLeft: `4px solid ${
                              alert.detection?.priority === 'critical' ? '#f44336' :
                              alert.detection?.priority === 'high' ? '#ff9800' :
                              alert.detection?.priority === 'medium' ? '#2196f3' : '#4caf50'
                            }`,
                            '&:hover': {
                              boxShadow: 2,
                              transform: 'translateY(-2px)',
                              transition: 'all 0.2s'
                            }
                          }}
                        >
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Box sx={{ flex: 1 }}>
                                {/* Alert Header */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {alert.detection?.emoji || '🐾'} {alert.detection?.display_name || 'Unknown Species'}
                                  </Typography>
                                  <Chip 
                                    label={alert.detection?.priority?.toUpperCase() || 'UNKNOWN'}
                                    size="small"
                                    color={getPriorityColor(alert.detection?.priority)}
                                    sx={{ fontWeight: 'bold' }}
                                  />
                                  {alert.status === 'acknowledged' ? (
                                    <Chip 
                                      label="ACKNOWLEDGED"
                                      size="small"
                                      color="success"
                                      variant="outlined"
                                    />
                                  ) : (
                                    <Chip 
                                      label="NEW"
                                      size="small"
                                      color="warning"
                                    />
                                  )}
                                  {(alert.has_image || alert.image_url) && (
                                    <Chip 
                                      icon={<ImageIcon fontSize="small" />}
                                      label="IMAGE"
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                                
                                {/* Alert Details */}
                                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <AccessTimeIcon fontSize="small" />
                                    {formatTime(alert.timestamp)} • {formatDate(alert.timestamp)}
                                  </Typography>
                                  
                                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <PetsIcon fontSize="small" />
                                    {(alert.detection?.confidence * 100).toFixed(1)}% confidence
                                  </Typography>
                                  
                                  {alert.location?.lat && alert.location?.lng && (
                                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <LocationOnIcon fontSize="small" />
                                      {alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)}
                                    </Typography>
                                  )}
                                  
                                  <Typography variant="body2">
                                    Device: {alert.device_id}
                                  </Typography>
                                </Box>
                                
                                {/* Image Preview - SHOWN RIGHT IN THE ALERT CARD */}
                                {(alert.has_image || alert.image_url) && alert.image_url && (
                                  <Box sx={{ mt: 2, mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                      <ImageIcon fontSize="small" /> Captured Image:
                                    </Typography>
                                    <Box 
                                      sx={{ 
                                        position: 'relative',
                                        width: '100%',
                                        maxWidth: 300,
                                        maxHeight: 200,
                                        overflow: 'hidden',
                                        borderRadius: 1,
                                        cursor: 'pointer',
                                        '&:hover img': {
                                          transform: 'scale(1.05)'
                                        }
                                      }}
                                      onClick={() => handleOpenImageModal(alert)}
                                    >
                                      <CardMedia
                                        component="img"
                                        image={alert.image_url}
                                        alt={`${alert.detection?.display_name} detection`}
                                        sx={{ 
                                          width: '100%',
                                          height: 'auto',
                                          objectFit: 'cover',
                                          transition: 'transform 0.3s'
                                        }}
                                      />
                                      <Box sx={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        bgcolor: 'rgba(0,0,0,0.5)',
                                        color: 'white',
                                        borderRadius: 1,
                                        p: 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5
                                      }}>
                                        <ZoomInIcon fontSize="small" />
                                      </Box>
                                    </Box>
                                  </Box>
                                )}
                                
                                {/* Additional Info */}
                                <Box sx={{ mt: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                  <Typography variant="caption" color="textSecondary">
                                    Category: {alert.detection?.category?.toUpperCase() || 'UNKNOWN'}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    Danger Level: {alert.detection?.danger?.toUpperCase() || 'UNKNOWN'}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    Alert ID: #{alert.id}
                                  </Typography>
                                  {(alert.has_image || alert.image_url) && (
                                    <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                                      📸 Image Available
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                              
                              {/* Action Buttons */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 2, minWidth: 120 }}>
                                {alert.location?.lat && alert.location?.lng && (
                                  <Button 
                                    size="small" 
                                    variant="outlined"
                                    startIcon={<MapIcon />}
                                    onClick={() => {
                                      setSelectedAlert(alert);
                                      setCurrentTab(1); // Switch to map tab
                                    }}
                                    fullWidth
                                  >
                                    View on Map
                                  </Button>
                                )}
                                
                                {alert.status !== 'acknowledged' && (
                                  <Button 
                                    size="small" 
                                    variant="contained"
                                    color="primary"
                                    onClick={() => handleAcknowledgeAlert(alert.id)}
                                    fullWidth
                                  >
                                    Acknowledge
                                  </Button>
                                )}

                                {(alert.has_image || alert.image_url) && (
                                  <>
                                    <Button 
                                      size="small" 
                                      variant="outlined"
                                      color="secondary"
                                      startIcon={<ZoomInIcon />}
                                      onClick={() => handleOpenImageModal(alert)}
                                      fullWidth
                                    >
                                      View Image
                                    </Button>
                                    <Button 
                                      size="small" 
                                      variant="outlined"
                                      color="info"
                                      startIcon={<DownloadIcon />}
                                      onClick={() => handleDownloadImage(alert)}
                                      fullWidth
                                    >
                                      Download
                                    </Button>
                                  </>
                                )}
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  )}
                </Paper>
              </>
            )}

            {/* MAP VIEW TAB */}
            {currentTab === 1 && (
              <Paper sx={{ p: 0, overflow: 'hidden', boxShadow: 3 }}>
                <RealMap 
                  alerts={alertsWithLocation}
                  height="650px"
                  onRefresh={loadData}
                  selectedAlert={selectedAlert}
                />
              </Paper>
            )}
          </>
        )}

        {/* Footer */}
        <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider', color: 'text.secondary' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                🌲 Wildlife Alert System v2.0 • Forest Monitoring Dashboard
              </Typography>
              <Typography variant="caption" display="block">
                Real-time animal detection and alert system for forest conservation
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" align="right">
                Status: {socketConnected ? '🟢 Live WebSocket' : '🔴 WebSocket Offline'} • 
                Backend: {backendStatus?.connected ? '🟢 Connected' : '🔴 Disconnected'} • 
                Alerts: {alerts.length} • 
                Images: {alertsWithImagesCount}
              </Typography>
              <Typography variant="caption" align="right" display="block">
                Last update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Container>

      {/* Image Modal */}
      {selectedImage && (
        <Modal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{
            position: 'relative',
            width: '90%',
            maxWidth: 800,
            maxHeight: '90vh',
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            p: 0,
            overflow: 'hidden'
          }}>
            <IconButton
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(0,0,0,0.5)',
                color: 'white',
                zIndex: 1,
                '&:hover': {
                  bgcolor: 'rgba(0,0,0,0.7)'
                }
              }}
              onClick={() => setImageModalOpen(false)}
            >
              ✕
            </IconButton>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              height: '70vh',
              p: 2
            }}>
              <img
                src={selectedImage}
                alt="Wildlife detection"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
              />
            </Box>
            {selectedAlert && (
              <Box sx={{ 
                p: 2, 
                borderTop: 1, 
                borderColor: 'divider',
                bgcolor: '#f5f5f5'
              }}>
                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {selectedAlert.detection?.emoji} {selectedAlert.detection?.display_name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Alert #{selectedAlert.id} • {formatFullTime(selectedAlert.timestamp)}
                </Typography>
                <Typography variant="body2">
                  Confidence: {(selectedAlert.detection?.confidence * 100).toFixed(1)}% • 
                  Priority: {selectedAlert.detection?.priority?.toUpperCase()}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined"
                    onClick={() => window.open(selectedImage, '_blank')}
                  >
                    Open in New Tab
                  </Button>
                  <Button 
                    size="small" 
                    variant="contained"
                    onClick={() => handleDownloadImage(selectedAlert)}
                  >
                    Download Image
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </Modal>
      )}

      {/* CSS Animation for Live Badge */}
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </ThemeProvider>
  );
}

export default App;