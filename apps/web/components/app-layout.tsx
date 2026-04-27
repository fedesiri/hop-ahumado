"use client";

import { useMediaQuery } from "@/lib/use-media-query";
import { Drawer, Layout } from "antd";
import { Flower2 } from "lucide-react";
import React, { useState } from "react";
import { AppSidebar, ToggleSidebarButton } from "./app-sidebar";
import { UserMenu } from "./auth/user-menu";

const { Header, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const toggleCollapsed = () => {
    if (isMobile) {
      setDrawerOpen(!drawerOpen);
    } else {
      setCollapsed(!collapsed);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden" }}>
      {isMobile ? (
        <Drawer
          title="Navegación"
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          styles={{ body: { padding: 0 } }}
          width={250}
        >
          <AppSidebar collapsed={false} onCollapsedChange={() => setDrawerOpen(false)} isMobile={true} />
        </Drawer>
      ) : (
        <AppSidebar collapsed={collapsed} onCollapsedChange={setCollapsed} isMobile={false} />
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 250,
          transition: "margin-left 0.2s",
          width: isMobile ? "100%" : undefined,
          maxWidth: isMobile ? "100vw" : undefined,
          minWidth: isMobile ? 0 : undefined,
        }}
      >
        <Header
          style={{
            padding: isMobile ? "0 12px" : "0 24px",
            background: "#1f2937",
            borderBottom: "1px solid #2d3748",
            height: isMobile ? 52 : 64,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 16 }}>
            <ToggleSidebarButton collapsed={isMobile ? drawerOpen : collapsed} onClick={toggleCollapsed} />
            {isMobile ? (
              <span style={{ display: "flex", alignItems: "center", color: "#22c55e" }}>
                <Flower2 size={24} strokeWidth={1.8} />
              </span>
            ) : (
              <h1
                style={{
                  margin: 0,
                  color: "#ffffff",
                  fontSize: 18,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Hop Ahumado
              </h1>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <UserMenu />
          </div>
        </Header>

        <Content
          style={{
            padding: isMobile ? 12 : 24,
            background: "#0a0a0a",
            minHeight: isMobile ? "calc(100vh - 52px)" : "calc(100vh - 64px)",
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
