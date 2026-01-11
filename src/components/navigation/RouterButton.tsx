// src/components/navigation/RouterButton.tsx
import React from "react";
import { Button, ButtonProps } from "@mui/material";
import { useNavigate } from "react-router-dom";

export type RouterButtonProps = Omit<ButtonProps, "onClick"> & {
  to: string;
};

const RouterButton = React.forwardRef<HTMLButtonElement, RouterButtonProps>(
  ({ to, ...buttonProps }, ref) => {
    const navigate = useNavigate();

    return <Button ref={ref} onClick={() => navigate(to)} {...buttonProps} />;
  }
);

export default RouterButton;
