export const cellGroups = (groups) => {
  const coordinates = [
    {
      name: 'P0',
      height: 800,
      width: 100,
      x: 50,
      y: 400
    },
    {
      name: 'AB',
      height: 400,
      width: 100,
      x: 150,
      y: 200
    },
    {
      name: 'P1',
      height: 400,
      width: 100,
      x: 150,
      y: 600
    },
    {
      name: 'ABa',
      height: 200,
      width: 100,
      x: 250,
      y: 100
    },
    {
      name: 'ABp',
      height: 200,
      width: 100,
      x: 250,
      y: 300
    },
    {
      name: 'EMS',
      height: 200,
      width: 100,
      x: 250,
      y: 500
    },
    {
      name: 'P2',
      height: 200,
      width: 100,
      x: 250,
      y: 700
    },
    {
      name: 'ABal',
      height: 100,
      width: 100,
      x: 350,
      y: 50
    },
    {
      name: 'ABar',
      height: 100,
      width: 100,
      x: 350,
      y: 150
    },
    {
      name: 'ABpl',
      height: 100,
      width: 100,
      x: 350,
      y: 250
    },
    {
      name: 'ABpr',
      height: 100,
      width: 100,
      x: 350,
      y: 350
    },
    {
      name: 'MS',
      height: 100,
      width: 100,
      x: 350,
      y: 450
    },
    {
      name: 'E',
      height: 100,
      width: 100,
      x: 350,
      y: 550
    },
    {
      name: 'C',
      height: 100,
      width: 100,
      x: 350,
      y: 650
    },
    {
      name: 'P3',
      height: 100,
      width: 100,
      x: 350,
      y: 750
    }
  ]
  for (const item of coordinates) {
    item.width *= 5
    item.height *= 2.5
    item.x *= 5
    item.x -= item.width / 2
    item.y *= 2.5
    item.y -= item.height / 2
  }
  const coordinatesMap = new Map(coordinates.map((item) => [item.name, item]))
  return groups.map(({name}) => coordinatesMap.get(name))
}
