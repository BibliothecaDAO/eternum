import { AutomationExportData, AutomationTemplate } from "../hooks/store/use-automation-store";

/**
 * Downloads the automation data as a JSON file
 * @param data The automation export data
 * @param filename Optional filename (defaults to automation-backup-{timestamp}.json)
 */
export const downloadAutomationBackup = (data: AutomationExportData, filename?: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const defaultFilename = `automation-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || defaultFilename;
  link.click();

  URL.revokeObjectURL(url);
};

/**
 * Downloads the automation template as a JSON file
 * @param template The automation template
 * @param filename Optional filename (defaults to automation-template-{timestamp}.json)
 */
export const downloadAutomationTemplate = (template: AutomationTemplate, filename?: string) => {
  const jsonString = JSON.stringify(template, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const templateName = template.templateName ? `-${template.templateName.replace(/\s+/g, "-")}` : "";
  const defaultFilename = `automation-template${templateName}-${new Date().toISOString().slice(0, 10)}.json`;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || defaultFilename;
  link.click();

  URL.revokeObjectURL(url);
};

/**
 * Reads a JSON file and returns the parsed automation data
 * @param file The file to read
 * @returns Promise that resolves to the automation data or rejects with an error
 */
export const readAutomationBackupFile = async (file: File): Promise<AutomationExportData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text) as AutomationExportData;
        resolve(data);
      } catch (error) {
        reject(new Error("Failed to parse JSON file"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
};

/**
 * Reads a JSON file and returns the parsed automation template
 * @param file The file to read
 * @returns Promise that resolves to the automation template or rejects with an error
 */
export const readAutomationTemplateFile = async (file: File): Promise<AutomationTemplate> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text) as AutomationTemplate;

        // Verify it's a template
        if (!data.isTemplate) {
          reject(new Error("File is not an automation template"));
          return;
        }

        resolve(data);
      } catch (error) {
        reject(new Error("Failed to parse JSON file"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
};

/**
 * Example usage:
 *
 * // Export
 * const automationStore = useAutomationStore();
 * const exportData = automationStore.exportAutomation();
 * downloadAutomationBackup(exportData);
 *
 * // Import
 * const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
 *   const file = event.target.files?.[0];
 *   if (file) {
 *     try {
 *       const data = await readAutomationBackupFile(file);
 *       const result = automationStore.importAutomation(data);
 *       if (result.success) {
 *         console.log("Import successful!");
 *       } else {
 *         console.error("Import failed:", result.error);
 *       }
 *     } catch (error) {
 *       console.error("Error reading file:", error);
 *     }
 *   }
 * };
 */
