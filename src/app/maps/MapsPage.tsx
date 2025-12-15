// src/app/maps/MapsPage.tsx — FINAL & 100% WORKING
import { Box, Typography, Paper, Alert, CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// Reliable, official Chester County 2024 precincts
const GEOJSON_URL =
  "https://services1.arcgis.com/3d8z7O5it5c6o0SL/arcgis/rest/services/Chester_County_Voting_Precincts_2024/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson";

export default function MapsPage() {
  const [userMeta, setUserMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  // FIXED: Correct way to set Leaflet icons
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  // Load GeoJSON
  useEffect(() => {
    console.log("Loading precinct map...");
    fetch(GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        console.log("Map loaded! Features:", data.features.length);
        setGeoJsonData(data);
      })
      .catch((err) => {
        console.error("Map load failed:", err);
        setGeoJsonData({ type: "FeatureCollection", features: [] });
      });
  }, []);

  // Auth
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, "users_meta", user.uid)).then((snap) => {
      if (snap.exists()) setUserMeta(snap.data());
      setLoading(false);
    });
  }, []);

  if (!auth.currentUser) return <Alert severity="warning">Please log in</Alert>;
  if (loading) return <CircularProgress />;
  if (!userMeta || userMeta.role !== "chairman" || userMeta.scope !== "area")
    return <Alert severity="error">Only Area Chairmen can view maps.</Alert>;

  const precinctStyle = () => ({
    color: "#333",
    weight: 2,
    fillOpacity: 0.25,
    fillColor: "#d32f2f",
  });

  const onEachFeature = (feature: any, layer: any) => {
    const p = feature.properties;
    const name = p.PRECINCT_NAME || p.PRECINCT || "Unknown Precinct";
    layer.bindPopup(
      `<strong>${name}</strong><br/>
       ${p.MUNICIPALITY || ""}${p.WARD ? ` Ward ${p.WARD}` : ""}`
    );
    layer.on({
      mouseover: (e: any) => e.target.setStyle({ weight: 4, fillOpacity: 0.6 }),
      mouseout: (e: any) => e.target.setStyle(precinctStyle()),
    });
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom fontWeight="bold" color="#B22234">
        Chester County — Interactive Precinct Map
      </Typography>

      <Paper sx={{ p: 4, height: "85vh", overflow: "hidden", borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="#0A3161">
          2024 Voting Precincts — Click for Details
        </Typography>
        <Box sx={{ height: "calc(100% - 50px)" }}>
          {geoJsonData ? (
            <MapContainer
              center={[40.0025, -75.7069]}
              zoom={10}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {geoJsonData.features.length > 0 ? (
                <GeoJSON
                  data={geoJsonData}
                  style={precinctStyle}
                  onEachFeature={onEachFeature}
                />
              ) : (
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  height="100%"
                  bgcolor="#f9f9f9"
                >
                  <Typography color="text.secondary">
                    Map data temporarily unavailable
                  </Typography>
                </Box>
              )}
            </MapContainer>
          ) : (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              height="100%"
              bgcolor="#f9f9f9"
            >
              <CircularProgress />
              <Typography ml={2}>Loading precinct boundaries...</Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
