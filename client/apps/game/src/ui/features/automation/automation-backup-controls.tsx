import React, { useRef, useState } from "react";
import { AutomationOrderTemplate, useAutomationStore } from "../../../hooks/store/use-automation-store";
import {
  downloadAutomationBackup,
  downloadAutomationTemplate,
  readAutomationBackupFile,
  readAutomationTemplateFile,
} from "../../../utils/automation-backup";
import Button from "@/ui/design-system/atoms/button";
import { Panel } from "@/ui/design-system/atoms";
import { FormField } from "@/ui/design-system/molecules";

interface AutomationBackupControlsProps {
  className?: string;
  onTemplateImport?: (orders: AutomationOrderTemplate[]) => void; // Callback when template orders are imported
}

export const AutomationBackupControls: React.FC<AutomationBackupControlsProps> = ({ className, onTemplateImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedRealmId, setSelectedRealmId] = useState<string>("");

  const { exportAutomation, importAutomation, exportAsTemplate, importTemplate, getAvailableRealms } =
    useAutomationStore();
  const availableRealms = getAvailableRealms();
  const controlClassName =
    "w-full px-3 py-2 border border-gold/20 bg-black/20 rounded transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold/30";

  const handleExport = () => {
    const data = exportAutomation();
    downloadAutomationBackup(data);
  };

  const handleExportTemplate = () => {
    const template = exportAsTemplate(
      templateName || undefined,
      templateDescription || undefined,
      selectedRealmId || undefined,
    );
    downloadAutomationTemplate(template);
    setShowTemplateModal(false);
    setTemplateName("");
    setTemplateDescription("");
    setSelectedRealmId("");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleTemplateImportClick = () => {
    templateFileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const data = await readAutomationBackupFile(file);
      const result = importAutomation(data);

      if (result.success) {
        setImportStatus({
          type: "success",
          message: "Automation rules imported successfully!",
        });
      } else {
        setImportStatus({
          type: "error",
          message: result.error || "Failed to import automation rules",
        });
      }
    } catch (error) {
      setImportStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to read file",
      });
    } finally {
      setIsImporting(false);
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleTemplateFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const template = await readAutomationTemplateFile(file);
      const orders = importTemplate(template);

      if (onTemplateImport) {
        onTemplateImport(orders);
        setImportStatus({
          type: "success",
          message: `Template imported: ${template.templateName || "Unnamed template"} (${orders.length} orders)`,
        });
      } else {
        setImportStatus({
          type: "error",
          message: "No handler configured for template import. Please assign orders to your realms manually.",
        });
      }
    } catch (error) {
      setImportStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to read template file",
      });
    } finally {
      setIsImporting(false);
      // Reset the input so the same file can be selected again
      if (templateFileInputRef.current) {
        templateFileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Personal Backup Section */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Personal Backup</h3>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="default" size="xs">
              Export Backup
            </Button>

            <Button onClick={handleImportClick} disabled={isImporting} variant="default" size="xs">
              {isImporting ? "Importing..." : "Import Backup"}
            </Button>
          </div>
        </div>

        {/* Template Sharing Section */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Share Templates</h3>
          <div className="flex gap-2">
            <Button onClick={() => setShowTemplateModal(true)} variant="gold" size="xs">
              Export as Template
            </Button>

            <Button onClick={handleTemplateImportClick} disabled={isImporting} variant="gold" size="xs">
              {isImporting ? "Importing..." : "Import Template"}
            </Button>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
        <input
          ref={templateFileInputRef}
          type="file"
          accept=".json"
          onChange={handleTemplateFileSelect}
          className="hidden"
        />

        {/* Status messages */}
        {importStatus && (
          <div className={`text-sm ${importStatus.type === "success" ? "text-green" : "text-red"}`}>
            {importStatus.message}
          </div>
        )}

        {/* Template Export Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Panel tone="glass" radius="md" padding="lg" className="w-full max-w-md bg-black/90">
              <h2 className="text-lg font-bold mb-4">Export as Template</h2>

              <div className="space-y-4">
                <FormField
                  label="Realm to Export"
                  htmlFor="realmSelect"
                  description='Select a specific realm to export only its automation strategy, or choose "All Realms" to export everything.'
                >
                  <select
                    id="realmSelect"
                    value={selectedRealmId}
                    onChange={(e) => setSelectedRealmId(e.target.value)}
                    className={controlClassName}
                  >
                    <option value="">All Realms (Legacy)</option>
                    {availableRealms.map((realm) => (
                      <option key={realm.id} value={realm.id}>
                        {realm.name || `Realm ${realm.id}`} ({realm.orderCount} orders)
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Template Name (optional)" htmlFor="templateName">
                  <input
                    id="templateName"
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Wood Production Strategy"
                    className={controlClassName}
                  />
                </FormField>

                <FormField label="Description (optional)" htmlFor="templateDescription">
                  <textarea
                    id="templateDescription"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Describe your automation strategy..."
                    rows={3}
                    className={controlClassName}
                  />
                </FormField>
              </div>

              <div className="flex gap-2 mt-6">
                <Button onClick={handleExportTemplate} variant="gold" size="md">
                  Export Template
                </Button>
                <Button
                  onClick={() => {
                    setShowTemplateModal(false);
                    setTemplateName("");
                    setTemplateDescription("");
                    setSelectedRealmId("");
                  }}
                  variant="default"
                  size="md"
                >
                  Cancel
                </Button>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
};
