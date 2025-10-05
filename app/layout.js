import './globals.css'

export const metadata = {
  title: 'Cannon Emulator',
  description: 'Responsive cannon + moving target emulator'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
