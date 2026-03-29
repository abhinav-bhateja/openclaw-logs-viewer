import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export const SheetContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800/80 bg-slate-900/95 shadow-xl focus:outline-none ${className || ''}`}
      {...props}
    >
      <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">Sidebar navigation</DialogPrimitive.Description>
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';
