module.exports = {
  photo: '/assets/photo-3d/sample-bear.jpg',
  model: '/assets/photo-3d/sample-bear.glb',
  // Order matches the design page: head, body, ears, arms, legs.
  fabricByPart: [0, 1, 1, 0, 1],
  fabrics: [
    { id: 'photo-stripes', image: '/assets/sample-stripes.png' },
    { id: 'photo-checks', image: '/assets/sample-checks.png' }
  ]
}
