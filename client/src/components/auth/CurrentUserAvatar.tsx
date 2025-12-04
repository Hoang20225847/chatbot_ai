import React, { useState } from "react";
import { useTheme } from "@mui/material/styles";
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";

import { useGetCurrentUser, useLogout } from "../../store/auth";

function CurrentUserAvatar() {
  const theme = useTheme();
  const { currentUser } = useGetCurrentUser();
  const { logout } = useLogout();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const openMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const closeMenu = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    closeMenu();
    logout();
  };

  return (
    <>
      <IconButton onClick={openMenu}>
        <Avatar sx={{ bgcolor: theme.palette.primary.contrastText }}>
          {currentUser?.email?.[0]?.toUpperCase()}
        </Avatar>
      </IconButton>
      <Menu
        open={menuOpen}
        anchorEl={anchorEl}
        onClose={closeMenu}
        sx={{ "& .MuiList-root": { width: "240px" } }}
      >
        <MenuItem disabled>
          <PersonIcon sx={{ marginRight: "10px" }} />
          <Typography
            variant="caption"
            sx={{ textOverflow: "ellipsis", overflow: "hidden" }}
          >
            {currentUser?.email}
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <LogoutIcon sx={{ marginRight: "10px" }} />
          <Typography variant="caption">Logout</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}

export default CurrentUserAvatar;
