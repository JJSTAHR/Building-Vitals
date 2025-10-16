/**
 * Re-export AddTokenDialog from canonical location
 *
 * This file maintains backwards compatibility for imports from the settings directory.
 * The canonical implementation is located at src/components/AddTokenDialog.tsx
 */

export { AddTokenDialog, type AddTokenDialogProps } from '../AddTokenDialog';
export default AddTokenDialog;
