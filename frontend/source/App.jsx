import { useEffect, useState } from "react";

export default function App() {
  const [stations, setStations] = useState([]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/stations?lat=${latitude}&lng=${longitude}`
      );

      const data = await res.json();
      setStations(data);
    });
  }, []);

  return (
    <div>
      <h1>Fewl ⛽</h1>
      {stations.map((s) => (
        <div key={s.id}>
          <h3>{s.name}</h3>
          <p>£{s.price}</p>
        </div>
      ))}
    </div>
  );
}
