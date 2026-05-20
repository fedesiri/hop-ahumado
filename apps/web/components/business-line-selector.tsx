"use client";

import { useLineContext } from "@/lib/line-context";
import { BusinessLine } from "@/lib/types";
import { Segmented } from "antd";

export function BusinessLineSelector() {
  const { selectedLine, setSelectedLine } = useLineContext();

  return (
    <Segmented
      value={selectedLine ?? BusinessLine.BEER}
      onChange={(value) => setSelectedLine(value as BusinessLine)}
      options={[
        { label: "Hop", value: BusinessLine.BEER },
        { label: "Alumo", value: BusinessLine.MEAT },
      ]}
      style={{ fontSize: 13 }}
    />
  );
}
