import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      closeButton
      containerAriaLabel="Notificações"
      toastOptions={{
        classNames: {
          toast: '!bg-surface !border-line !text-foreground !font-sans !rounded-md',
          description: '!text-sand',
          closeButton: '!bg-surface-2 !border-line !text-orange',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
