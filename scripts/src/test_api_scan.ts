async function runTestApi() {
  const qrData = JSON.stringify({
    v: 1,
    id: "IIECS-001",
    token: "iiecs-103v704",
    name: "Meerab faisal Faisal",
    course: "No",
    batch: "Batch A - Web Development Batch B - C/C++ Algorithms Batch C - Python & AI Agents"
  });

  console.log("Sending scan request with payload:", qrData);

    try {
      const res = await fetch("http://localhost:3000/api/attendance/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ qrData }),
      });

      console.log("Response Status:", res.status);
      const body = await res.json();
      console.log("Response Body:", body);
    } catch (err) {
    console.error("Fetch failed:", err);
  }
}

runTestApi();
