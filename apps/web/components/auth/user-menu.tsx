"use client";

import { useAuth } from "@/lib/auth-context";
import { useMediaQuery } from "@/lib/use-media-query";
import { LogoutOutlined } from "@ant-design/icons";
import { Avatar, Button, Dropdown, MenuProps, Space, Spin } from "antd";
import { useRouter } from "next/navigation";

export function UserMenu() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const displayName = user?.name || user?.email || "Usuario";

  const items: MenuProps["items"] = [
    {
      key: "users",
      label: "Usuarios",
    },
    {
      type: "divider",
    } as any,
    {
      key: "logout",
      label: "Deslogear",
      icon: <LogoutOutlined />,
      danger: true,
    },
  ];

  if (loading) {
    return (
      <div style={{ width: 120, display: "flex", justifyContent: "flex-end" }}>
        <Spin size="small" style={{ color: "#22c55e" }} />
      </div>
    );
  }

  if (!user) {
    return <Button type="primary">Ingresá</Button>;
  }

  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <Dropdown
        menu={{
          items,
          onClick: async (info) => {
            if (info.key === "users") router.push("/users");
            if (info.key === "logout") await logout();
          },
        }}
        trigger={["click"]}
      >
        <Button
          type="text"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 0,
          }}
        >
          <Space align="center">
            <Avatar style={{ backgroundColor: "#22c55e" }}>{(displayName[0] || "U").toUpperCase()}</Avatar>
            {!isMobile && (
              <span
                style={{ color: "#ffffff", fontSize: 13, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {displayName}
              </span>
            )}
          </Space>
        </Button>
      </Dropdown>
    </div>
  );
}
