import words from './en.json'

const getRandom = (items) => items[Math.floor(Math.random() * items.length)]
const isVowel = (char) => 'aeiou'.includes(char)
const isConsonant = (char) => !isVowel(char)
const fromLast = (word, i) => word[word.length - 1 - i]
const progressive = (val) => {
  let verb = val
  switch (verb) {
    case 'bar':
    case 'mar':
    case 'star':
    case 'stir':
    case 'deter':
      return `${verb}ring`
    case 'develop':
      return `${verb}ing`
    default: {
      const last = fromLast(verb, 0)
      const last2 = fromLast(verb, 1)
      if (last === 'e' && last2 === 'i') {
        verb = `${verb.slice(0, -2)}y`
      } else if (last === 'e' && last2 !== 'e') {
        verb = verb.slice(0, -1)
      } else if (isConsonant(last) && isVowel(last2) && isConsonant(fromLast(verb, 2))) {
        if (!(['r', 'w', 'x', 'y'].includes(last) || ((last2 === 'e' || last2 === 'o') && last === 'n'))) {
          verb += last
        }
      }

      return `${verb}ing`
    }
  }
}

const data = words

export default () => {
  // console.log('username: generating a new native american-like name')
  const modifierSrc = getRandom(['adjectives', 'verbs'])
  let modifier = getRandom(data[modifierSrc])
  if (modifierSrc === 'verbs') modifier = progressive(modifier)
  return `${modifier} ${getRandom(data.animals)}`
}
