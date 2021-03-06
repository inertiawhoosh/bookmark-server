const { expect } = require('chai')
const knex = require('knex')
const app = require('../src/app')
const { makeBookmarksArray } = require('./api/bookmarks.fixtures')

describe('Bookmarks Endpoints', function() {
  let db

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    })
    app.set('db', db)
  })

  after('disconnect from db', () => db.destroy())

  before('clean the table', () => db('bookmarks').truncate())

  afterEach('cleanup', () => db('bookmarks').truncate())
  
  describe('GET /api/bookmarks', () => {
    context('Given no bookmarks', () => {
      it('responds with 200 and an empty list', () => {
        return supertest(app)
          .get('/api/bookmarks')
          .expect(200, {})
      })
    })
    context('Given there are bookmarks in the database', () => {
    	const testBookmarks = makeBookmarksArray()

  	beforeEach('insert bookmarks', () => {
  		return db
  			.into('bookmarks')
  			.insert(testBookmarks)
  	})
  	it('GET /api/bookmarks responds with 200 and all of the bookmarks', () => {
  		return supertest(app)
  			.get('/api/bookmarks')
  			.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
  			.expect(200, testBookmarks)
  	})
  })

	describe(`GET /api/bookmarks/:bookmarks_id`, () => {
    context('given no bookmarks', () => {
      it('responds with 404', () => {
        const bookmarkId=123456
        return supertest(app)
          .get(`/api/bookmarks/${bookmarkId}`)
          .expect(404, {error: { message: `Bookmark does not exist`}})
      })
    })
    context('Given an XSS attack bookmark', () => {
      const maliciousBookmark = {
        id: 911,
        title: "bad bookmark",
        url: "awful",
        description: "seriously",
        rating: 0,
      }
      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks')
          .insert([ maliciousBookmark ])
      })
      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/bookmarks/${maliciousBookmark.id}`
            .expect(200)
            .expect(res => {
              expect(res.body.title).to.eql(`bad bookmark`)
              expect(res.body.description).to.eql('seriously')
              expect(res.body.url).to.eql('awful')
            }))
      })
    })
    it('Get /api/bookmarks/:bookmark_id responds with 200 and the specified bookmark', () => {
  		const bookmarkId = 2
  		const expectedBookmark = testBookmarks[bookmarkId -1]
  		return supertest(app)
  			.get('/api/bookmarks/${bookmarkId}')
  			.set('Authorization', `Bearer ${process.env.API_TOKEN}`)
  			.expect(200, expectedBookmark)
  	   })
     })
  })
  describe('Post /api/bookmarks', () => {
    it('creates a bookmark, responding with 201 and the new bookmark', function() {
      this.retries(3)
      const newBookmark = {
        title: 'test bookmark',
          url: 'testbookmark.com',
          description: 'test',
          rating: '5'
      }
      return supertest(app)
        .post('/api/bookmarks')
        .send(newBookmark)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.equal(newBookmark.title)
          expect(res.body.url).to.equal(newBookmark.url)
          expect(res.body.description).to.equal(newBookmark.description)
          expect(res.body.rating).to.equal(newBookmark.rating)
          expect(res.body).to.have.property('id')
        })
        .then(postRes => 
          supertest(app)
            .get(`/api/bookmarks/${postRes.body.id}`)
            .expect(postRes.body)
            )
    })
    const requiredFields = ['title', 'url', 'rating']

    requiredFields.forEach(field => {
      const newBookmark = {
          title: 'test bookmark',
          url: 'testbookmark.com',
          description: 'test',
          rating: '5'
      }
      it(`responds with 400 and an error message when the ${field} is missing`)
      delete newBookmark[field]

      return supertest(app)
        .post('/api/bookmarks')
        .send(newBookmark)
        .expect(400,  {
          error: { message: `missing ${field}`}
        })
     })
    })
  describe(`DELETE /api/bookmarks/:id`, () => {
    context('given no bookmarks', () => {
      it('responds with 404', () => {
        const bookmarkId = 123456
        return supertest(app)
          .delete(`/api/bookmarks/${bookmarkId}`)
          .expect(404, { error: { message: 'article doesn't exist'}})
      })
    })
    context('Given there are bookmarks in the database', () => {
      const testBookmarks = makeBookmarksArray()

      beforeEach('insert Bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks)
      })
      it('responds with 204 and removes bookmark', () => {
        const idToRemove = 2
        const expectedBookmarks = testBookmarks.filter(bookmark => bookmark.id !== idToRemove)
        return supertest(app)
          .delete(`/api/bookmarks/${idToRemove}`)
          .expect(204)
          .then(res => 
            supertest(app)
              .get(`/articles`)
              .expect(expectedArticles)
              )
      })
    })
  })
    describe.only('PATCH /api/bookmarks:id', () => {
      context('given no bookmarks', () => {
        it(`responds with 404`, () => {
          const bookmarkId = 123456
          return supertest(app)
          .patch(`/api/bookmarks/${bookmarkId}`)
          .expect(404, {error: { message: `bookmark does not exist`}})
        }
      })
    })
      context('Given there are bookmarks in the database', () => {
        const testBookmarks = makeBookmarksArray()
        beforeEach('insert bookmarks', () => {
          return db
            .into('bookmarks')
            .insert(testBookmarks)
        })
        it('responds with 204 and updates the bookmark', () => {
          const idToUpdate = 2
          const updateBookmark = {
          title: 'test bookmark',
          url: 'testbookmark.com',
          description: 'test',
          rating: '5'
          }
          const expectedBookmark = {
            ...testBookmarks[idToUpdate -1],
            ...updateArticle
          }
          return supertest(app)
            .patch(`/api/bookmarks/${idToUpdate}`)
            .send(updateBookmark)
            .expect(204)
            .then(res => 
              supertest(app)
                .get(`/api/bookmarks/${idToUpdate}`)
                .expect(expectedBookmark)
                )

        })
        it('responds with 400 when no required fields supplied', () => {
          const idToUpdate = 2
          return supertest(app)
            .patch(`/api/bookmarks/${idToUpdate}`)
            .send({ irrelevantField: 'foo' })
            .expect(400, {
              error {
                message: 'Request body must contain required fields'
              }
            })
          it('responds with 204 when updating only a subset of fields', () => {
            const idToUpdate = 2
            const updateBookmark = {
              title: "updated bookmark title",
            }
            const expectedBookmark = {
              ...testBookmarks[idToUpdate - 1],
              ...updateArticle
            }
            return supertest(app)
            .patch(`/api/bookmarks/${idToUpdate}`)
            .send({
              ...updateBookmark,
              fieldToIgnore: 'should not be in a GET response'
            })
            .expect(204)
            .then( res => 
              supertest(app)
                .get(`/api/bookmarks/${idToUpdate}`)
                .expect(expectedArticle)
                )
          })
        })
      })
  })
