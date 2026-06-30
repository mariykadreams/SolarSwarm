import { Badge, Card, Progress } from "flowbite-react";
import { mockState } from "../mockData/mockState";

const roleLabel = (node) => {
  if (node.role === "master") return "Master";
  return `Slave #${node.node_id}`;
};

const NodeCard = ({ node }) => {
  const isPrimary = node.soc === Math.max(...mockState.nodes.filter(n => n.online).map(n => n.soc));

  return (
    <Card className={`relative ${isPrimary && node.online ? "ring-2 ring-emerald-400 shadow-[0_0_20px_4px_rgba(52,211,153,0.4)]" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-bold text-gray-900 dark:text-white">{roleLabel(node)}</span>
        <Badge color={node.online ? "success" : "failure"}>
          {node.online ? "Online" : "Offline"}
        </Badge>
      </div>

      {isPrimary && node.online && (
        <span className="text-xs font-semibold text-emerald-400 mb-2 block">★ PRIMARY (active relay)</span>
      )}

      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>State of Charge</span>
          <span className="font-semibold text-gray-900 dark:text-white">{node.soc}%</span>
        </div>
        <Progress
          progress={node.soc}
          color={node.soc > 30 ? "green" : node.soc > 10 ? "yellow" : "red"}
          size="md"
        />
      </div>

      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
        <span>Brightness</span>
        <span className="font-semibold text-gray-900 dark:text-white">{node.brightness_actual}%</span>
      </div>
      <Progress progress={node.brightness_actual} color="blue" size="sm" />

      <div className="mt-3 text-xs text-gray-500 dark:text-gray-500 space-y-1">
        {node.rssi_wifi != null && <div>WiFi RSSI: {node.rssi_wifi} dBm</div>}
        {node.rssi_espnow != null && <div>ESP-NOW RSSI: {node.rssi_espnow} dBm</div>}
        <div>Light level: {node.light_level}</div>
      </div>
    </Card>
  );
};

const NodesComponent = () => {
  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Node Status</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {mockState.nodes.map((node) => (
          <NodeCard key={node.node_id} node={node} />
        ))}
      </div>
    </div>
  );
};

export default NodesComponent;