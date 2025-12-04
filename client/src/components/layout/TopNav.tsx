import React from "react";
import AppBar from "@mui/material/AppBar";

export const TOP_NAV_HEIGHT = 60;

function TopNav({ children }: { children: React.ReactNode }) {
  return (
    <AppBar
      position="fixed"
      sx={{
        height: TOP_NAV_HEIGHT,
        padding: "10px 20px",
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {children}
    </AppBar>
  );
}

export default TopNav;
