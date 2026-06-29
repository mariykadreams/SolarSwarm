import { useState } from 'react'
import Header from './components/Header'
import Footers from './components/Footer'
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Header/>
      <Footers/>
    </>
  )
}

export default App
